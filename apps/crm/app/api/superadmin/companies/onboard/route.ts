import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { onboardCompany } from '@/lib/services/company-onboarding-service'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail, generateMagicLinkEmailHTML } from '@/lib/email'

export const dynamic = 'force-dynamic'

interface OnboardRequest {
  email: string
  sendMagicLink?: boolean
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * POST /api/superadmin/companies/onboard
 * 
 * Manually onboard a new company:
 * - Create user (if doesn't exist)
 * - Create company
 * - Assign user as owner
 * - Grant enterprise subscription (free)
 * - Optionally send magic link
 * 
 * Requires: SuperAdmin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // 🔒 Require SuperAdmin authentication
    const adminSession = await requireSuperAdmin(request)

    // Parse request body
    let body: OnboardRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { email, sendMagicLink } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required and must be a string' },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    console.log('[API /superadmin/companies/onboard] Starting onboarding for:', email)

    // Execute onboarding
    const result = await onboardCompany(
      email.toLowerCase().trim(),
      adminSession.user_id
    )

    if (!result.success) {
      console.error('[API /superadmin/companies/onboard] Onboarding failed:', result.error)
      return NextResponse.json(
        { error: result.error || 'Onboarding failed' },
        { status: 500 }
      )
    }

    console.log('[API /superadmin/companies/onboard] Onboarding successful:', {
      company_id: result.company_id,
      user_id: result.user_id,
    })

    // Generate and send magic link if requested
    let actionLink: string | undefined
    let emailSent = false
    let emailError: string | null = null
    let method: 'invite' | 'magiclink' = 'magiclink'

    if (sendMagicLink && result.user_id) {
      try {
        const supabaseAdmin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        )

        const callbackUrl = `${request.nextUrl.origin}/auth/callback`

        // Try generateLink first (for existing users - PKCE flow)
        const { data: linkData, error: linkErr } =
          await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink' as any,
            email: email.toLowerCase().trim(),
            options: {
              redirectTo: callbackUrl,
            },
          })

        if (linkErr || !linkData?.properties?.action_link) {
          // If generateLink fails (user not found or other error), try inviteUserByEmail
          console.log('[API /superadmin/companies/onboard] generateLink failed, trying inviteUserByEmail...')
          
          const { data: inviteData, error: inviteErr } =
            await supabaseAdmin.auth.admin.inviteUserByEmail(email.toLowerCase().trim(), {
              redirectTo: callbackUrl,
            })

          if (inviteErr) {
            emailError = `Failed to send invite: ${inviteErr.message}`
            console.error('[API /superadmin/companies/onboard] inviteUserByEmail error:', inviteErr)
          } else {
            // inviteUserByEmail sends email via Supabase, no action_link returned
            method = 'invite'
            emailSent = true // Supabase sends the invite email
            actionLink = undefined // No action_link for invite
            console.log('[API /superadmin/companies/onboard] ✓ Invite sent via Supabase')
          }
        } else {
          // generateLink succeeded - we have action_link, send via Zoho
          actionLink = linkData.properties.action_link
          method = 'magiclink'

          // Send email via Zoho (only when we have actionLink)
          try {
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
              const html = generateMagicLinkEmailHTML(actionLink, email.toLowerCase().trim())
              await sendEmail({
                to: email.toLowerCase().trim(),
                subject: 'Your CRM Login Link - AluminCRM',
                html,
              })
              emailSent = true
              console.log('[API /superadmin/companies/onboard] ✓ Email sent via Zoho')
            } else {
              emailError = 'Email not configured (EMAIL_USER/EMAIL_PASS missing)'
              console.warn('[API /superadmin/companies/onboard] ⚠️', emailError)
            }
          } catch (emailErr: any) {
            emailError = emailErr.message || 'Failed to send email'
            console.error('[API /superadmin/companies/onboard] ✗ Email send failed:', emailError)
          }
        }
      } catch (linkErr: any) {
        emailError = linkErr.message || 'Failed to generate magic link'
        console.error('[API /superadmin/companies/onboard] Exception generating magic link:', linkErr)
      }
    }

    return NextResponse.json({
      success: true,
      company_id: result.company_id,
      user_id: result.user_id,
      company_name: result.company_name,
      magic_link: actionLink,
      email_sent: emailSent,
      email_error: emailError || undefined,
      method,
    })
  } catch (error: any) {
    console.error('[API /superadmin/companies/onboard] Unexpected error:', error)

    // Check if it's an auth error
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
