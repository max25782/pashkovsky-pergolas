import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyGoogleToken, isGoogleOAuthConfigured } from '@/lib/auth/oauth/google'
import { signToken } from '@/lib/auth/jwt'
import { generateToken, hashToken, getExpirationTime } from '@/lib/auth/tokens'
import { logAuthEvent } from '@/lib/audit/logger'

// Force dynamic rendering - uses request.url
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * GET /api/auth/oauth/google/callback
 * Handle Google OAuth callback
 */
export async function GET(req: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(`${APP_URL}/auth/login?error=oauth_not_configured`)
  }

  if (!supabase) {
    return NextResponse.redirect(`${APP_URL}/auth/login?error=server_error`)
  }

  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      return NextResponse.redirect(`${APP_URL}/he/auth/login?error=no_code`)
    }

    // Parse state to get redirect URL
    let redirectUrl = '/he/admin'
    let locale = 'he'
    try {
      if (state) {
        const stateData = JSON.parse(state)
        redirectUrl = stateData.redirect || '/he/admin'
        // Extract locale from redirectUrl
        const localeMatch = redirectUrl.match(/\/(he|en|ru)\//)
        if (localeMatch) {
          locale = localeMatch[1]
        }
      }
    } catch {
      // Ignore state parsing errors
    }

    // Verify Google token and get user info
    const googleUser = await verifyGoogleToken(code)

    // Check if user exists
    let { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('email', googleUser.email)
      .single()

    // If user doesn't exist, create them
    if (!user) {
      // Generate a random password (user won't need it with OAuth)
      const { hashPassword } = await import('@/lib/auth/password')
      const tempPassword = generateToken(32)
      const passwordHash = await hashPassword(tempPassword)

      // Create user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: googleUser.email,
          password_hash: passwordHash,
          full_name: googleUser.name,
          avatar_url: googleUser.picture,
          email_verified_at: new Date().toISOString(), // Google emails are verified
        })
        .select()
        .single()

      if (createError || !newUser) {
        console.error('[Google OAuth] User creation error:', createError)
        return NextResponse.redirect(`${APP_URL}/auth/login?error=user_creation_failed`)
      }

      user = newUser

      // Create default company for new user
      const companyName = `${googleUser.name}'s Company`
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName,
          slug,
          status: 'trial',
          plan: 'trial',
          industry: 'general',
          primary_email: googleUser.email,
          trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      if (companyError || !company) {
        console.error('[Google OAuth] Company creation error:', companyError)
        // Continue anyway - user is created
      } else {
        // Add user as owner
        await supabase
          .from('company_members')
          .insert({
            company_id: company.id,
            user_id: user.id,
            role: 'owner',
            joined_at: new Date().toISOString(),
          })

        // Create trial subscription
        const { data: trialPlan } = await supabase
          .from('plans')
          .select('id')
          .eq('key', 'trial')
          .single()

        if (trialPlan) {
          await supabase
            .from('subscriptions')
            .insert({
              company_id: company.id,
              plan_id: trialPlan.id,
              status: 'trialing',
              payment_provider: 'manual',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            })
        }
      }
    }

    // Get user's company memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from('company_members')
      .select(`
        *,
        company:companies(*)
      `)
      .eq('user_id', user.id)

    if (membershipsError) {
      console.error('[Google OAuth] Error fetching memberships:', membershipsError)
      return NextResponse.redirect(`${APP_URL}/${locale}/auth/login?error=memberships_error`)
    }

    if (!memberships || memberships.length === 0) {
      console.error('[Google OAuth] No company memberships found for user:', user.id)
      return NextResponse.redirect(`${APP_URL}/${locale}/auth/login?error=no_company`)
    }

    // Get default company
    const defaultMembership = memberships.find((m: any) => m.role === 'owner') || memberships[0]
    
    if (!defaultMembership || !defaultMembership.company_id) {
      console.error('[Google OAuth] No valid membership found')
      return NextResponse.redirect(`${APP_URL}/${locale}/auth/login?error=invalid_membership`)
    }

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      companyId: defaultMembership.company_id,
      role: defaultMembership.role,
    })

    // Generate refresh token
    const refreshToken = generateToken()
    const refreshTokenHash = hashToken(refreshToken)
    const refreshExpiresAt = getExpirationTime(30 * 24) // 30 days

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Save refresh token
    await supabase
      .from('refresh_tokens')
      .insert({
        user_id: user.id,
        token_hash: refreshTokenHash,
        expires_at: refreshExpiresAt,
        ip_address: ipAddress,
        device_info: userAgent.substring(0, 255),
      })

    // Update last login
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // Log auth event
    await logAuthEvent(req, 'login', 'success', undefined, {
      userId: user.id,
      email: user.email,
      provider: 'google',
    })

    // Redirect to login page with tokens (login page will handle saving tokens and redirecting)
    const loginUrl = new URL(`${APP_URL}/${locale}/auth/login`)
    loginUrl.searchParams.set('token', token)
    loginUrl.searchParams.set('refreshToken', refreshToken)
    loginUrl.searchParams.set('oauth', 'google')
    loginUrl.searchParams.set('redirect', redirectUrl) // Store original redirect URL

    return NextResponse.redirect(loginUrl.toString())

  } catch (error: any) {
    console.error('[Google OAuth] Callback error:', error)
    return NextResponse.redirect(`${APP_URL}/he/auth/login?error=oauth_failed&details=${encodeURIComponent(error.message || 'Unknown error')}`)
  }
}

