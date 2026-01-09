/**
 * SuperAdmin API - Send Magic Link
 * Allows SuperAdmin to send magic login link to users
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, generateMagicLinkEmailHTML } from '@/lib/email'

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

export async function POST(request: NextRequest) {
  try {
    // TODO: Add SuperAdmin auth check here
    // const session = await checkSuperAdminAuth(request)
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: RequestBody = await request.json()
    const { email, redirectTo } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Magic link MUST redirect to /auth/callback for SSR cookies
    // Callback will then redirect to the final destination
    const callbackUrl = `${request.nextUrl.origin}/auth/callback`
    const finalDestination = redirectTo || '/app/admin'
    
    console.log('[SendMagicLink] Generating magic link for:', email)
    console.log('[SendMagicLink] Callback URL:', callbackUrl)
    console.log('[SendMagicLink] Final destination:', finalDestination)

    // Check if user exists
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    // Use different type based on whether user exists
    // For existing users: try 'recovery' first, fallback to 'signup' if needed
    // For new users: use 'invite' (creates user + PKCE flow)
    // 'magiclink' type uses implicit flow (#access_token) which doesn't work with SSR cookies
    let linkType = existingUser ? 'recovery' : 'invite'
    
    console.log('[SendMagicLink] User exists:', !!existingUser, 'Using type:', linkType)

    let { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: linkType as any,
      email,
      options: {
        redirectTo: callbackUrl,
      },
    })

    // If recovery fails for existing user, try signup (works as magic link)
    if (error && existingUser && linkType === 'recovery') {
      console.warn('[SendMagicLink] Recovery failed, trying signup as fallback:', error.message)
      linkType = 'signup'
      const signupResult = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup' as any,
        email,
        options: {
          redirectTo: callbackUrl,
          // Signup without password requirement
        },
      })
      if (!signupResult.error && signupResult.data) {
        data = signupResult.data
        error = null
        console.log('[SendMagicLink] ✓ Signup fallback succeeded')
      } else {
        error = signupResult.error
        console.error('[SendMagicLink] Signup fallback also failed:', signupResult.error)
      }
    }

    if (error || !data) {
      console.error('[SendMagicLink] Error:', error)
      
      // Provide more specific error messages
      let errorMessage = error?.message || 'Failed to generate magic link'
      
      if (error?.message?.includes('already been registered')) {
        errorMessage = 'User already exists. Using recovery link type.'
      } else if (error?.message?.includes('User not found')) {
        errorMessage = 'User not found. Please create the user first or use onboarding form.'
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

    // At this point we know data.properties.action_link exists (checked above)
    const actionLink = data.properties!.action_link

    // Send email via Zoho
    let emailSent = false
    let emailError: string | null = null
    
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const html = generateMagicLinkEmailHTML(actionLink, email)
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
      magicLink: actionLink,
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

