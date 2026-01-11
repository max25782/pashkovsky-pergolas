import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { sendEmail, generateMagicLinkEmailHTML } from '@/lib/email'

export const dynamic = 'force-dynamic'

interface InviteRequest {
  email: string
  company_id: string
  role: 'owner' | 'admin' | 'worker' | 'viewer'
}

export async function POST(req: NextRequest) {
  try {
    // 🔒 Require SuperAdmin authentication
    await requireSuperAdmin(req)

    const body: InviteRequest = await req.json()
    const { email, company_id, role = 'worker' } = body

    // Validation
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'email is required and must be a string' },
        { status: 400 }
      )
    }

    if (!company_id || typeof company_id !== 'string') {
      return NextResponse.json(
        { error: 'company_id is required and must be a string' },
        { status: 400 }
      )
    }

    const validRoles: Array<'owner' | 'admin' | 'worker' | 'viewer'> = ['owner', 'admin', 'worker', 'viewer']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    const cleanEmail = email.toLowerCase().trim()
    const callbackUrl = `${req.nextUrl.origin}/auth/callback?next=/app`

    console.log('[InviteUser] Starting invite flow:', { email: cleanEmail, company_id, role })

    // Create service role client
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    // Step 1: Ensure user exists
    let userId: string

    // Check if user exists
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (listError) {
      console.error('[InviteUser] Error listing users:', listError)
      return NextResponse.json(
        { error: 'Failed to check user existence' },
        { status: 500 }
      )
    }

    const existingUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === cleanEmail
    )

    // Store whether user exists for link type selection
    let userExists = false
    
    if (existingUser) {
      userId = existingUser.id
      userExists = true
      console.log('[InviteUser] User exists:', userId)
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          full_name: cleanEmail.split('@')[0],
        },
      })

      if (createError || !newUser.user) {
        console.error('[InviteUser] Error creating user:', createError)
        return NextResponse.json(
          { error: `Failed to create user: ${createError?.message || 'Unknown error'}` },
          { status: 500 }
        )
      }

      userId = newUser.user.id
      console.log('[InviteUser] Created new user:', userId)
    }

    // Step 2: Upsert membership
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('company_members')
      .upsert(
        {
          user_id: userId,
          company_id,
          role,
        },
        {
          onConflict: 'user_id,company_id',
        }
      )
      .select()
      .single()

    if (membershipError || !membership) {
      console.error('[InviteUser] Error upserting membership:', membershipError)
      return NextResponse.json(
        { error: `Failed to add user to company: ${membershipError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log('[InviteUser] Membership upserted:', membership.id)

    // Step 3: Ensure trial exists (idempotent - only if missing)
    const { data: existingSubscription } = await supabaseAdmin
      .from('company_subscriptions')
      .select('id, status, trial_ends_at')
      .eq('company_id', company_id)
      .single()

    if (!existingSubscription) {
      // Get trial plan ID
      const { data: trialPlan } = await supabaseAdmin
        .from('subscription_plans')
        .select('id')
        .eq('plan_key', 'trial')
        .single()

      if (trialPlan) {
        const { error: subError } = await supabaseAdmin
          .from('company_subscriptions')
          .insert({
            company_id,
            plan_id: trialPlan.id,
            status: 'trialing',
            payment_provider: 'manual',
            trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })

        if (subError) {
          console.error('[InviteUser] Error creating trial subscription:', subError)
          // Don't fail the invite if subscription creation fails
        } else {
          console.log('[InviteUser] Trial subscription created for company:', company_id)
        }
      }
    } else {
      console.log('[InviteUser] Subscription already exists for company:', company_id)
    }

    // Step 4: Generate magic link (PKCE flow for login)
    // CRITICAL: 'magiclink' type generates implicit flow (#access_token) - NOT PKCE!
    // Use 'invite' for new users or 'recovery' for existing users to get PKCE flow (?code=...)
    const linkType = userExists ? 'recovery' : 'invite'
    console.log('[InviteUser] Generating magic link (PKCE flow) with type:', linkType, 'for user:', userExists ? 'existing' : 'new')
    
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: linkType as any, // 'invite' or 'recovery' - both generate PKCE flow with ?code=
      email: cleanEmail,
      options: {
        redirectTo: callbackUrl,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[InviteUser] Error generating magic link:', linkError)
      console.error('[InviteUser] Link data:', linkData)
      return NextResponse.json(
        { error: `Failed to generate magic link: ${linkError?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const actionLink = linkData.properties.action_link
    console.log('[InviteUser] Magic link generated successfully')
    console.log('[InviteUser] Link preview (first 200 chars):', actionLink.substring(0, 200))
    
    // Verify link contains code parameter (PKCE flow)
    try {
      const linkUrl = new URL(actionLink)
      const hasCode = linkUrl.searchParams.has('code')
      const hasHash = linkUrl.hash.includes('access_token')
      
      console.log('[InviteUser] Link analysis:', {
        hasCode,
        hasHash,
        redirectTo: linkUrl.searchParams.get('redirect_to') || 'none',
        type: linkUrl.searchParams.get('type') || 'none',
        fullUrl: actionLink.substring(0, 300), // First 300 chars for debugging
      })
      
      if (!hasCode) {
        console.error('[InviteUser] ❌ CRITICAL: Link does NOT contain code parameter!')
        console.error('[InviteUser] This means PKCE flow will fail. Link type:', linkType)
        console.error('[InviteUser] Full link:', actionLink)
        
        if (hasHash) {
          console.error('[InviteUser] Link contains hash fragment - this is IMPLICIT FLOW, not PKCE!')
          return NextResponse.json(
            { error: 'Generated link uses implicit flow instead of PKCE. Please check Supabase settings.' },
            { status: 500 }
          )
        }
      } else {
        console.log('[InviteUser] ✅ Link contains code parameter - PKCE flow will work')
      }
    } catch (urlError: any) {
      console.error('[InviteUser] Error parsing link URL:', urlError)
      // Continue anyway - link might still work
    }

    // Step 5: Send email via Zoho
    let emailSent = false
    let emailError: string | null = null

    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const html = generateMagicLinkEmailHTML(actionLink, cleanEmail)
        await sendEmail({
          to: cleanEmail,
          subject: 'Your CRM Access - AluminCRM',
          html,
        })
        emailSent = true
        console.log('[InviteUser] ✓ Email sent via Zoho')
      } else {
        emailError = 'Email not configured (EMAIL_USER/EMAIL_PASS missing)'
        console.warn('[InviteUser] ⚠️', emailError)
      }
    } catch (emailErr: any) {
      emailError = emailErr.message || 'Failed to send email'
      console.error('[InviteUser] ✗ Email send failed:', emailError)
    }

    return NextResponse.json({
      ok: true,
      user_id: userId,
      membership_id: membership.id,
      magic_link: actionLink,
      email_sent: emailSent,
      email_error: emailError || undefined,
    })
  } catch (error: any) {
    console.error('[InviteUser] Unexpected error:', error)

    if (error.message?.includes('Unauthorized') || error.message?.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Unauthorized: SuperAdmin access required' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

