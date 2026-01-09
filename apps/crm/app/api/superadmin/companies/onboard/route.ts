import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'
import { onboardCompany } from '@/lib/services/company-onboarding-service'
import { createClient } from '@supabase/supabase-js'
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

    // Execute onboarding (no magic link generation)
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

    // Generate magic link if requested
    let magicLink: string | undefined
    let emailSent = false
    let emailError: string | null = null
    
    if (sendMagicLink) {
      try {
        const supabaseAdmin = createClient(
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
        
        // Check if user exists to use correct link type
        const { data: users } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
        const linkType = existingUser ? 'magiclink' : 'invite'
        
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: linkType as any,
          email: email.toLowerCase().trim(),
          options: {
            redirectTo: callbackUrl,
          },
        })

        if (!linkError && linkData?.properties?.action_link) {
          magicLink = linkData.properties.action_link
          console.log('[API /superadmin/companies/onboard] Magic link generated')
          
          // Send email via Zoho
          try {
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
              const html = generateMagicLinkEmailHTML(magicLink, email.toLowerCase().trim())
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
        } else {
          console.error('[API /superadmin/companies/onboard] Failed to generate magic link:', linkError)
        }
      } catch (linkErr: any) {
        console.error('[API /superadmin/companies/onboard] Exception generating magic link:', linkErr)
      }
    }

      return NextResponse.json({
        success: true,
        company_id: result.company_id,
        user_id: result.user_id,
        company_name: result.company_name,
        magic_link: magicLink,
        email_sent: emailSent,
        email_error: emailError || undefined,
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
