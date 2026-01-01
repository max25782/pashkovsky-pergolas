import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
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
 * POST /api/auth/setup-company
 * Create company and link to Supabase Auth user
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
    const { user_id, email, full_name, company_name, industry } = body

    // Validate required fields
    if (!user_id || !email || !company_name) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, email, company_name' },
        { status: 400 }
      )
    }

    console.log('[Setup Company] Creating company for user:', user_id)

    // Step 1: Check if user already has a company
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user_id)
      .single()

    if (existingMember) {
      console.log('[Setup Company] User already has a company')
      return NextResponse.json({ 
        success: true,
        message: 'User already has a company',
        company_id: existingMember.company_id
      })
    }

    // Step 2: Create company
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
      console.error('[Setup Company] Company creation error:', companyError)
      return NextResponse.json(
        { error: 'Failed to create company' },
        { status: 500 }
      )
    }

    console.log('[Setup Company] Company created:', company.id)

    // Step 3: Add user as owner of the company
    const { error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: user_id,
        role: 'owner',
        permissions: { all: true },
        joined_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('[Setup Company] Membership error:', memberError)
      // Rollback
      await supabase.from('companies').delete().eq('id', company.id)
      return NextResponse.json(
        { error: 'Failed to create membership' },
        { status: 500 }
      )
    }

    // Step 4: Create initial subscription (trial plan)
    const { error: subscriptionError } = await supabase
      .from('company_subscriptions')
      .insert({
        company_id: company.id,
        plan: 'trial',
        status: 'active',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        started_at: new Date().toISOString(),
      })

    if (subscriptionError) {
      console.error('[Setup Company] Subscription error:', subscriptionError)
      // Continue anyway, subscription is not critical
    }

    // Step 5: Create default settings
    const { error: settingsError } = await supabase
      .from('company_settings')
      .insert({
        company_id: company.id,
        settings: {
          currency: 'ILS',
          timezone: 'Asia/Jerusalem',
          language: 'he',
        },
      })

    if (settingsError) {
      console.error('[Setup Company] Settings error:', settingsError)
      // Continue anyway, settings are not critical
    }

    console.log('[Setup Company] Setup complete for company:', company.id)

    return NextResponse.json({
      success: true,
      company_id: company.id,
      company_name: company.name,
      trial_ends_at: company.trial_ends_at,
    })
  } catch (error) {
    console.error('[Setup Company] Error:', error)
    return NextResponse.json(
      { error: 'Failed to setup company' },
      { status: 500 }
    )
  }
}

