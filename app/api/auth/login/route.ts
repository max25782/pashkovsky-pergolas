import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /api/auth/login
 * Login user and return user data with company info
 */
export async function POST(req: NextRequest) {
  if (!supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  try {
    const body = await req.json()
    const { email, password } = body

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password' },
        { status: 400 }
      )
    }

    // Step 1: Authenticate with Supabase Auth
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.error('[Login] Auth error:', authError)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }

    const userId = authData.user.id

    // Step 2: Get user data from public.users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.error('[Login] User fetch error:', userError)
      return NextResponse.json(
        { error: 'User data not found' },
        { status: 500 }
      )
    }

    // Step 3: Get user's companies and memberships
    const { data: memberships, error: memberError } = await supabase
      .from('company_members')
      .select(`
        *,
        company:companies(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')

    if (memberError) {
      console.error('[Login] Membership fetch error:', memberError)
      return NextResponse.json(
        { error: 'Failed to fetch company data' },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'No active company membership found' },
        { status: 403 }
      )
    }

    // Step 4: Update last_seen_at
    await supabase
      .from('users')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId)

    // Return user data with companies
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        locale: user.locale,
      },
      session: {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at,
      },
      companies: memberships.map(m => ({
        membership_id: m.id,
        role: m.role,
        joined_at: m.joined_at,
        company: m.company,
      })),
      default_company: memberships[0].company, // First company as default
    }, { status: 200 })

  } catch (error: any) {
    console.error('[Login] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

