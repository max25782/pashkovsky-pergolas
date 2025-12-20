import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashToken, isTokenExpired } from '@/lib/auth/tokens'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /api/auth/verify-email/confirm
 * Confirm email verification token
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
    const { token, email } = body

    if (!token || !email) {
      return NextResponse.json(
        { error: 'Token and email are required' },
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
      return NextResponse.json(
        { error: 'Invalid verification link' },
        { status: 400 }
      )
    }

    // Check if already verified
    if (user.email_verified_at) {
      return NextResponse.json({
        success: true,
        message: 'Email is already verified',
        verified: true,
      })
    }

    // Hash the provided token
    const tokenHash = hashToken(token)

    // Find verification token
    const { data: verificationToken, error: tokenError } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('token', tokenHash)
      .is('used_at', null)
      .single()

    if (tokenError || !verificationToken) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (isTokenExpired(verificationToken.expires_at)) {
      return NextResponse.json(
        { error: 'Verification token has expired' },
        { status: 400 }
      )
    }

    // Mark token as used
    await supabase
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', verificationToken.id)

    // Verify user email
    const { error: updateError } = await supabase
      .from('users')
      .update({ email_verified_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('[Verify Email] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to verify email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      verified: true,
    })

  } catch (error: any) {
    console.error('[Verify Email] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


