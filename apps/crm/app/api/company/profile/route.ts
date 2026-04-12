/**
 * Company Profile API
 * GET: Retrieve company profile
 * PUT: Update company profile
 * Only accessible by company members with appropriate permissions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { CompanyMember } from '@/types/membership'

export const dynamic = 'force-dynamic'

type MembershipPick = Pick<CompanyMember, 'company_id' | 'role' | 'permissions'> & {
  companies?: {
    created_at: string
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company memberships (choose most recent owner, else most recent company)
    const { data: memberships, error: membershipError } = await supabase
      .from('company_members')
      .select(
        `
          company_id,
          role,
          permissions,
          companies!inner (
            created_at
          )
        `
      )
      .eq('user_id', user.id) as { data: MembershipPick[] | null; error: any }

    if (membershipError) {
      return NextResponse.json({ error: 'Failed to load company memberships' }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const owners = memberships.filter((m) => m.role === 'owner')
    const candidates = owners.length > 0 ? owners : memberships
    candidates.sort((a, b) => {
      const da = new Date(a.companies?.created_at ?? 0).getTime()
      const db = new Date(b.companies?.created_at ?? 0).getTime()
      return db - da
    })
    const membership = candidates[0]

    // Get company profile
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', membership.company_id)
      .single()

    if (companyError) {
      return NextResponse.json({ error: companyError.message }, { status: 500 })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('[Company Profile GET] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Use user session to verify identity
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to bypass RLS for company creation
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check user doesn't already have a company
    const { data: existing } = await serviceClient
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'User already has a company' }, { status: 409 })
    }

    const body = await request.json()
    const { name, industry } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now()

    // Create company (service role bypasses RLS)
    const { data: company, error: companyError } = await serviceClient
      .from('companies')
      .insert({
        name: name.trim(),
        slug,
        industry: industry || 'aluminum',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (companyError) {
      console.error('[Company Profile POST] Create error:', companyError)
      return NextResponse.json({ error: companyError.message }, { status: 500 })
    }

    // Add user as owner
    const { error: memberError } = await serviceClient
      .from('company_members')
      .insert({
        company_id: company.id,
        user_id: user.id,
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (memberError) {
      console.error('[Company Profile POST] Member insert error:', memberError)
      // Rollback company creation
      await serviceClient.from('companies').delete().eq('id', company.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json(company, { status: 201 })
  } catch (error) {
    console.error('[Company Profile POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Get memberships (choose most recent owner, else most recent company)
    const { data: memberships, error: membershipError } = await supabase
      .from('company_members')
      .select(
        `
          company_id,
          role,
          permissions,
          companies!inner (
            created_at
          )
        `
      )
      .eq('user_id', user.id) as { data: MembershipPick[] | null; error: any }

    if (membershipError) {
      return NextResponse.json({ error: 'Failed to load company memberships' }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    const owners = memberships.filter((m) => m.role === 'owner')
    const candidates = owners.length > 0 ? owners : memberships
    candidates.sort((a, b) => {
      const da = new Date(a.companies?.created_at ?? 0).getTime()
      const db = new Date(b.companies?.created_at ?? 0).getTime()
      return db - da
    })
    const membership = candidates[0]

    // Check if user has permission to edit company settings
    const canEdit = 
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.permissions?.settings === true

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      )
    }

    // Update company profile
    const { data: company, error: updateError } = await supabase
      .from('companies')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membership.company_id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(company)
  } catch (error) {
    console.error('[Company Profile PUT] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

