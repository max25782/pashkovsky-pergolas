import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { sendEmail, generateMagicLinkEmailHTML } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 🔒 Require SuperAdmin authentication
    await requireSuperAdmin(req)

    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email_required' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const callbackUrl = `${req.nextUrl.origin}/auth/callback`

    let actionLink: string | null = null
    let method: 'invite' | 'recovery' = 'invite'
    let emailSent = false
    let emailError: string | null = null

    // Check if user exists to determine link type
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })
    const userExists = usersData?.users?.some(
      (u) => u.email?.toLowerCase() === cleanEmail
    )

    // Use 'recovery' for existing users, 'invite' for new users (both generate PKCE flow)
    const linkType = userExists ? 'recovery' : 'invite'
    console.log('[SendMagicLink] Generating link with type:', linkType, 'for user:', userExists ? 'existing' : 'new')

    // 1) Try generateLink first (PKCE flow with ?code= parameter)
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: linkType as any, // 'recovery' or 'invite' - both generate PKCE flow
      email: cleanEmail,
      options: { redirectTo: callbackUrl },
    })

    if (!linkErr && linkData?.properties?.action_link) {
      actionLink = linkData.properties.action_link
      method = linkType

      // Verify link contains code parameter (PKCE flow)
      try {
        const linkUrl = new URL(actionLink)
        const hasCode = linkUrl.searchParams.has('code')
        const hasHash = linkUrl.hash.includes('access_token')
        
        console.log('[SendMagicLink] Link analysis:', {
          hasCode,
          hasHash,
          type: linkType,
          redirectTo: linkUrl.searchParams.get('redirect_to') || 'none',
        })
        
        if (!hasCode && hasHash) {
          console.error('[SendMagicLink] ❌ Link uses implicit flow (#access_token) instead of PKCE (?code=)')
          console.error('[SendMagicLink] This will NOT work with SSR cookies. Link:', actionLink.substring(0, 200))
        } else if (hasCode) {
          console.log('[SendMagicLink] ✅ Link contains code parameter - PKCE flow will work')
        }
      } catch (urlError) {
        console.warn('[SendMagicLink] Could not parse link URL:', urlError)
      }

      // Send via Zoho (your mailer)
      try {
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
          const html = generateMagicLinkEmailHTML(actionLink, cleanEmail)
          await sendEmail({
            to: cleanEmail,
            subject: 'Your CRM Login Link - AluminCRM',
            html,
          })
          emailSent = true
          console.log('[SendMagicLink] ✓ Email sent via Zoho')
        } else {
          emailError = 'Email not configured (EMAIL_USER/EMAIL_PASS missing)'
          console.warn('[SendMagicLink] ⚠️', emailError)
        }
      } catch (emailErr: any) {
        emailError = emailErr.message || 'Failed to send email'
        console.error('[SendMagicLink] ✗ Email send failed:', emailError)
      }

      return NextResponse.json({
        ok: true,
        method,
        actionLink,
        email_sent: emailSent,
        email_error: emailError || undefined,
      })
    }

    // 2) If generateLink fails (often because user doesn't exist), fallback to invite
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
      redirectTo: callbackUrl,
    })

    if (inviteErr) {
      return NextResponse.json(
        { error: inviteErr.message || 'invite_failed' },
        { status: 500 }
      )
    }

    // IMPORTANT: inviteUserByEmail does NOT return action_link
    // Supabase sends the invite email itself.
    method = 'invite'
    actionLink = null
    emailSent = true

    return NextResponse.json({
      ok: true,
      method,
      email_sent: emailSent,
      note: 'Invite email sent by Supabase (no action_link available)',
    })
  } catch (e: any) {
    console.error('[SendMagicLink] Exception:', e)
    
    // Check if it's an auth error
    if (e.message?.includes('Unauthorized') || e.message?.includes('Authentication required')) {
      return NextResponse.json(
        { error: 'Unauthorized: SuperAdmin access required' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: e.message || 'internal_error' }, { status: 500 })
  }
}
