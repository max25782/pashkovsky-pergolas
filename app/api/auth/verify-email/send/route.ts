import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateToken, hashToken, getExpirationTime } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/email'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /api/auth/verify-email/send
 * Send email verification token
 */
export async function POST(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, email_verified_at')
      .eq('email', email)
      .single()

    if (userError || !user) {
      // Don't reveal if user exists (security best practice)
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a verification email has been sent',
      })
    }

    // Check if already verified
    if (user.email_verified_at) {
      return NextResponse.json({
        success: true,
        message: 'Email is already verified',
      })
    }

    // Generate verification token
    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = getExpirationTime(24) // 24 hours

    // Invalidate any existing tokens for this user
    await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null)

    // Create new verification token
    const { error: tokenError } = await supabase
      .from('email_verification_tokens')
      .insert({
        user_id: user.id,
        token: tokenHash,
        expires_at: expiresAt,
      })

    if (tokenError) {
      console.error('[Verify Email] Token creation error:', tokenError)
      return NextResponse.json(
        { error: 'Failed to create verification token' },
        { status: 500 }
      )
    }

    // Send verification email
    const verificationUrl = `${APP_URL}/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`

    try {
      await sendEmail({
        to: email,
        subject: 'Подтвердите ваш email',
        html: `
          <h2>Подтверждение email</h2>
          <p>Нажмите на ссылку ниже, чтобы подтвердить ваш email:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <p>Ссылка действительна в течение 24 часов.</p>
          <p>Если вы не запрашивали это подтверждение, просто проигнорируйте это письмо.</p>
        `,
        text: `Подтвердите ваш email, перейдя по ссылке: ${verificationUrl}`,
      })
    } catch (emailError) {
      console.error('[Verify Email] Email sending error:', emailError)
      // Don't fail the request if email fails (token is still created)
    }

    return NextResponse.json({
      success: true,
      message: 'Verification email sent',
    })

  } catch (error: any) {
    console.error('[Verify Email] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


