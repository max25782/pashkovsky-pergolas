import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hashToken, isTokenExpired } from '@/lib/auth/tokens'
import { signToken } from '@/lib/auth/jwt'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
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
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      )
    }

    // Hash the provided refresh token
    const tokenHash = hashToken(refreshToken)

    // Find refresh token in database
    const { data: storedToken, error: tokenError } = await supabase
      .from('refresh_tokens')
      .select(`
        *,
        user:users(id, email)
      `)
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .single()

    if (tokenError || !storedToken) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    // Check if token is expired
    if (isTokenExpired(storedToken.expires_at)) {
      // Mark as revoked
      await supabase
        .from('refresh_tokens')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', storedToken.id)

      return NextResponse.json(
        { error: 'Refresh token has expired' },
        { status: 401 }
      )
    }

    // Get user's company memberships
    const { data: memberships } = await supabase
      .from('company_members')
      .select(`
        *,
        company:companies(*)
      `)
      .eq('user_id', storedToken.user_id)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'No company membership found' },
        { status: 403 }
      )
    }

    // Get default company
    const defaultMembership = memberships.find((m: any) => m.role === 'owner') || memberships[0]

    // Generate new access token
    const newAccessToken = signToken({
      userId: storedToken.user_id,
      email: (storedToken.user as any).email,
      companyId: defaultMembership.company_id,
      role: defaultMembership.role,
    })

    // Update last_used_at
    await supabase
      .from('refresh_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', storedToken.id)

    return NextResponse.json({
      success: true,
      token: newAccessToken,
    })

  } catch (error: any) {
    console.error('[Refresh Token] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



