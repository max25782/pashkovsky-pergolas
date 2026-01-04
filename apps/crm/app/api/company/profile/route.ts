/**
 * Company Profile API
 * GET: Retrieve company profile
 * PUT: Update company profile
 * Only accessible by company members with appropriate permissions
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CompanyMember } from '@/types/membership'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company membership
    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id, role, permissions')
      .eq('user_id', user.id)
      .single<Pick<CompanyMember, 'company_id' | 'role' | 'permissions'>>()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

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

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Get user's company membership and check permissions
    const { data: membership, error: membershipError } = await supabase
      .from('company_members')
      .select('company_id, role, permissions')
      .eq('user_id', user.id)
      .single<Pick<CompanyMember, 'company_id' | 'role' | 'permissions'>>()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

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

