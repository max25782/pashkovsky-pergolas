import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateToken, hashToken, getExpirationTime } from '@/lib/auth/tokens'
import { sendEmail } from '@/lib/email'
import { rateLimiters } from '@/lib/middleware/rate-limit'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /api/auth/password-reset/request
 * Request password reset
 */
export async function POST(req: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimiters.auth.passwordReset(req)
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'Too many password reset requests. Please try again later.',
        retryAfter: rateLimitResult.retryAfter 
      },
      { 
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter || 3600),
        }
      }
    )
  }

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
      .select('id, email, full_name')
      .eq('email', email)
      .single()

    // Don't reveal if user exists (security best practice)
    if (userError || !user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists, a password reset email has been sent',
      })
    }

    // Generate reset token
    const token = generateToken()
    const tokenHash = hashToken(token)
    const expiresAt = getExpirationTime(1) // 1 hour

    // Invalidate any existing reset tokens for this user
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('used_at', null)

    // Create new reset token
    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: tokenHash,
        expires_at: expiresAt,
      })

    if (tokenError) {
      console.error('[Password Reset] Token creation error:', tokenError)
      return NextResponse.json(
        { error: 'Failed to create reset token' },
        { status: 500 }
      )
    }

    // Send reset email
    const resetUrl = `${APP_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`

    try {
      await sendEmail({
        to: email,
        subject: 'Сброс пароля',
        html: `
          <h2>Сброс пароля</h2>
          <p>Вы запросили сброс пароля для вашего аккаунта.</p>
          <p>Нажмите на ссылку ниже, чтобы установить новый пароль:</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Ссылка действительна в течение 1 часа.</p>
          <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
        `,
        text: `Сброс пароля: ${resetUrl}`,
      })
    } catch (emailError) {
      console.error('[Password Reset] Email sending error:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset email sent',
    })

  } catch (error) {
    console.error('[Password Reset] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

