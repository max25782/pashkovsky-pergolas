import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyPassword } from '@/lib/auth/password'
import { signToken } from '@/lib/auth/jwt'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/**
 * POST /api/auth/login
 * Login user and return JWT token with company info
 */
export async function POST(req: NextRequest) {
  if (!supabase || !SUPABASE_URL) {
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

    // Step 1: Get user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !user) {
      console.error('[Login] User not found:', email)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Step 2: Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash)
    if (!isPasswordValid) {
      console.error('[Login] Invalid password for:', email)
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Step 3: Get user's companies and memberships
    const { data: memberships, error: memberError } = await supabase
      .from('company_members')
      .select(`
        *,
        company:companies(*)
      `)
      .eq('user_id', user.id)

    if (memberError) {
      console.error('[Login] Membership fetch error:', memberError)
      return NextResponse.json(
        { error: 'Failed to fetch company data' },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json(
        { error: 'No company membership found. Please contact support.' },
        { status: 403 }
      )
    }

    // Get the default company (first one or owner role)
    const defaultMembership = memberships.find(m => m.role === 'owner') || memberships[0]

    // Step 4: Generate JWT token
    const token = signToken({
      userId: user.id,
      email: user.email,
      companyId: defaultMembership.company_id,
      role: defaultMembership.role,
    })

    // Step 5: Update last_login_at
    await supabase
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id)

    // Return user data with JWT token
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      },
      companies: memberships.map(m => ({
        id: m.company.id,
        name: m.company.name,
        slug: m.company.slug,
        role: m.role,
        status: m.company.status,
        plan: m.company.plan,
      })),
      default_company: {
        id: defaultMembership.company.id,
        name: defaultMembership.company.name,
        slug: defaultMembership.company.slug,
        role: defaultMembership.role,
      },
    }, { status: 200 })

  } catch (error: any) {
    console.error('[Login] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

