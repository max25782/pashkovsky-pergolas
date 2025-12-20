import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
}

/**
 * POST /api/auth/register
 * Register a new company with owner user
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
    const { email, password, full_name, company_name, industry } = body

    // Validate required fields
    if (!email || !password || !full_name || !company_name) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, full_name, company_name' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Step 1: Create user in Supabase Auth
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: authData, error: authError } = await authClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
        }
      }
    })

    if (authError) {
      console.error('[Register] Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    const userId = authData.user.id

    // Step 2: Create user record in public.users table
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        full_name,
      })

    if (userError) {
      console.error('[Register] User table error:', userError)
      // Rollback: delete auth user
      await authClient.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to create user record' },
        { status: 500 }
      )
    }

    // Step 3: Create company
    const slug = generateSlug(company_name)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: company_name,
        slug,
        status: 'trial',
        plan: 'trial',
        industry: industry || 'general',
        primary_email: email,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days trial
      })
      .select()
      .single()

    if (companyError || !company) {
      console.error('[Register] Company creation error:', companyError)
      // Rollback
      await supabase.from('users').delete().eq('id', userId)
      await authClient.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    // Step 4: Add user as owner of the company
    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
      })

    if (memberError) {
      console.error('[Register] Membership error:', memberError)
      // Rollback
      await supabase.from('companies').delete().eq('id', company.id)
      await supabase.from('users').delete().eq('id', userId)
      await authClient.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 }
      )
    }

    // Success!
    return NextResponse.json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: userId,
        email,
        full_name,
      },
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
    }, { status: 201 })

  } catch (error: any) {
    console.error('[Register] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

