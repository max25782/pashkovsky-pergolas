/**
 * Get Current User's Company
 * Returns the company information for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

export async function GET(req: NextRequest) {
  try {
    // Authenticate request
    const authResult = await requireAuthAsync(req)
    if (!authResult.authorized) {
      return authResult.error
    }

    const { context } = authResult
    
    if (!context.companyId) {
      return NextResponse.json(
        { error: 'No company membership found' },
        { status: 404 }
      )
    }

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Get company details and user's role
    const { data: membership, error: memberError } = await supabase
      .from('company_members')
      .select('role, company:companies(id, name, slug, status, plan)')
      .eq('user_id', context.userId)
      .eq('company_id', context.companyId)
      .single()

    if (memberError || !membership) {
      return NextResponse.json(
        { error: 'Company membership not found' },
        { status: 404 }
      )
    }

    const company = Array.isArray(membership.company) 
      ? membership.company[0] 
      : membership.company

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        status: company.status,
        plan: company.plan,
      },
      role: membership.role,
    })
  } catch (error) {
    console.error('[API] Get current company error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

