/**
 * SuperAdmin API - Send Magic Link
 * Allows SuperAdmin to send magic login link to users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, generateMagicLinkEmailHTML } from '@/lib/email'
import { requireSuperAdmin } from '@/lib/middleware/superadmin-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface RequestBody {
  email: string
  redirectTo?: string
}

function sanitizeNext(input?: string): string {
  if (!input) return '/app'
  if (!input.startsWith('/')) return '/app'
  if (input.startsWith('//')) return '/app'
  return input
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request)

    const body: RequestBody = await request.json()
    const { email, redirectTo } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // IMPORTANT:
    // We DO NOT email the Supabase /auth/v1/verify link directly because it ends up
    // redirecting with a #access_token fragment (server can't see it).
    //
    // Instead:
    // - generateLink(type=magiclink) to get a one-time token
    // - email OUR callback: /auth/callback?token=...&type=magiclink&next=/app
    const next = sanitizeNext(redirectTo)
    const callbackUrl = `${request.nextUrl.origin}/auth/callback`
    
    console.log('[SendMagicLink] Generating magic link for:', email)
    console.log('[SendMagicLink] Callback URL:', callbackUrl)
    console.log('[SendMagicLink] Next:', next)

    // Ensure user exists (this endpoint is "send login access", not onboarding)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    if (listError) {
      console.error('[SendMagicLink] listUsers error:', listError)
      return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 })
    }
    const existingUser = users?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found. Create the company/user first, then send access.' },
        { status: 404 }
      )
    }

    // Use 'invite' type for PKCE flow (not 'magiclink' which may use implicit flow)
    // 'invite' generates PKCE code that redirects to callback with ?code=...
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        // PKCE flow requires redirectTo to be exactly our callback URL
        redirectTo: callbackUrl,
      },
    })

    if (error || !data) {
      console.error('[SendMagicLink] Error:', error)
      
      // Provide more specific error messages
      let errorMessage = error?.message || 'Failed to generate magic link'
      
      if (error?.message?.includes('User not found')) {
        errorMessage = 'User not found. Create the company/user first, then send access.'
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    console.log('[SendMagicLink] ✓ Magic link generated successfully')
    
    if (!data.properties?.action_link) {
      console.error('[SendMagicLink] ❌ Action link is missing from response')
      return NextResponse.json(
        { error: 'Magic link generated but action_link is missing' },
        { status: 500 }
      )
    }
    
    console.log('[SendMagicLink] Action link:', data.properties.action_link)
    
    // Extract and log the redirect_to parameter from the action link
    try {
      const actionUrl = new URL(data.properties.action_link)
      const redirectToParam = actionUrl.searchParams.get('redirect_to')
      const tokenParam = actionUrl.searchParams.get('token')
      const typeParam = actionUrl.searchParams.get('type')
      
      console.log('[SendMagicLink] ===================')
      console.log('[SendMagicLink] Action link analysis:')
      console.log('[SendMagicLink] - redirect_to:', redirectToParam || '❌ MISSING!')
      console.log('[SendMagicLink] - token:', tokenParam ? `✓ (${tokenParam.substring(0, 20)}...)` : '✗')
      console.log('[SendMagicLink] - type:', typeParam || 'none')
      console.log('[SendMagicLink] - Expected redirect_to:', callbackUrl)
      console.log('[SendMagicLink] - Match:', redirectToParam === callbackUrl ? '✅ YES' : '❌ NO')
      
      if (!redirectToParam) {
        console.error('[SendMagicLink] ❌ CRITICAL: redirect_to parameter is missing from action link!')
        console.error('[SendMagicLink] This means Supabase will redirect to Site URL instead')
      } else if (redirectToParam !== callbackUrl) {
        console.warn('[SendMagicLink] ⚠️ WARNING: redirect_to mismatch!')
        console.warn('[SendMagicLink] Expected:', callbackUrl)
        console.warn('[SendMagicLink] Got:', redirectToParam)
      }
      console.log('[SendMagicLink] ===================')
    } catch (e) {
      console.error('[SendMagicLink] ❌ Could not parse action link URL:', e)
    }

    // For PKCE flow ('invite' type), Supabase generates a link that redirects to callback with ?code=...
    // We should email the action_link directly (Supabase handles PKCE exchange)
    // However, if we want to add ?next=, we need to extract the code and rebuild
    const actionUrl = new URL(data.properties.action_link)
    const code = actionUrl.searchParams.get('code')
    
    // If PKCE code exists, build our callback URL with code and next
    // Otherwise, use action_link as-is (fallback)
    const appLink = code 
      ? `${callbackUrl}?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`
      : data.properties.action_link

    // Send email via Zoho
    let emailSent = false
    let emailError: string | null = null
    
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const html = generateMagicLinkEmailHTML(appLink, email)
        await sendEmail({
          to: email,
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
      // Don't fail the whole request if email fails - magic link is still generated
    }

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? `Magic link sent to ${email}` 
        : `Magic link generated${emailError ? ` (email not sent: ${emailError})` : ''}`,
      magicLink: appLink,
      emailSent,
      emailError: emailError || undefined,
    })
  } catch (error: any) {
    console.error('[SendMagicLink] Exception:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

