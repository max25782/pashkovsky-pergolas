import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type Company = {
  id: string
  name: string
  status: string
  created_at: string
}

type MembershipWithCompany = {
  role: string
  companies: Company
}

export async function GET() {
  try {
    
    const supabase = createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }


    // Get all memberships for this user - pick oldest company (has real data)
    const { data: rawMemberships, error: rawError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)

    if (rawError) {
      console.error('[companies/me] Error fetching raw memberships:', rawError)
      return NextResponse.json(
        { error: 'Failed to load company memberships' },
        { status: 500 }
      )
    }


    if (!rawMemberships || rawMemberships.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Try join with companies!inner (RLS enforced)
    const { data: membershipsWithCompanies, error: joinError } = await supabase
      .from('company_members')
      .select(
        `
        role,
        companies!inner (
          id,
          name,
          status,
          created_at
        )
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { foreignTable: 'companies', ascending: true })
      .limit(1)
      .maybeSingle<MembershipWithCompany>()

    // If join succeeded and returned data, use it
    if (membershipsWithCompanies && !joinError && membershipsWithCompanies.companies) {
      const company = membershipsWithCompanies.companies
      const response = {
        company_id: company.id,
        company_name: company.name,
        role: membershipsWithCompanies.role,
        status: company.status,
      }
      return NextResponse.json(response)
    }

    // If join failed but we have raw memberships, RLS is blocking access to companies
    // Fallback: fetch company via service role (only for the user's own memberships)
    
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Get the oldest membership's company_id (most likely to have real data)
    const newestMembership = rawMemberships[rawMemberships.length - 1]
    if (!newestMembership || !newestMembership.company_id) {
      console.error('[companies/me] Invalid membership data:', newestMembership)
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = newestMembership.company_id

    const { data: company, error: companyError } = await service
      .from('companies')
      .select('id, name, status, created_at')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      console.error('[companies/me] Service role fallback failed:', companyError)
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const response = {
      company_id: company.id,
      company_name: company.name,
      role: newestMembership.role || 'worker',
      status: company.status,
    }
    return NextResponse.json(response)
  } catch (error: unknown) {
    const e = error as Error & { stack?: string }
    console.error('[companies/me] Unexpected error:', error)
    console.error('[companies/me] Error stack:', e?.stack)
    // Always return valid JSON, never throw
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
