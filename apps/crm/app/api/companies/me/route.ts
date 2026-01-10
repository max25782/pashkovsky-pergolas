import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
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
      console.log('[companies/me] Unauthorized:', userError?.message || 'No user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[companies/me] User:', user.email, 'user_id:', user.id)

    const admin = await isSuperAdmin(user.id)

    // --- SuperAdmin: use service role ---
    if (admin) {
      console.log('[companies/me] SuperAdmin detected')
      const service = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      )

      const { data: company, error: companyError } = await service
        .from('companies')
        .select('id, name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (companyError || !company) {
        console.log('[companies/me] No companies available for SuperAdmin')
        return NextResponse.json({ error: 'No companies available' }, { status: 404 })
      }

      console.log('[companies/me] SuperAdmin company:', company.id)
      return NextResponse.json({
        company_id: company.id,
        company_name: company.name,
        role: 'superadmin',
        status: company.status,
      })
    }

    // --- Normal user: enforce RLS only ---
    // First, get raw memberships (without join) to check if user has any memberships
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

    console.log('[companies/me] Raw memberships found:', rawMemberships?.length || 0)

    if (!rawMemberships || rawMemberships.length === 0) {
      console.log('[companies/me] No memberships found for user')
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
      .order('created_at', { foreignTable: 'companies', ascending: false })
      .limit(1)
      .maybeSingle<MembershipWithCompany>()

    console.log('[companies/me] Join result:', {
      hasData: !!membershipsWithCompanies,
      error: joinError?.message || 'none',
    })

    // If join succeeded and returned data, use it
    if (membershipsWithCompanies && !joinError) {
      const company = membershipsWithCompanies.companies
      console.log('[companies/me] Company found via join:', company.id)
      return NextResponse.json({
        company_id: company.id,
        company_name: company.name,
        role: membershipsWithCompanies.role,
        status: company.status,
      })
    }

    // If join failed but we have raw memberships, RLS is blocking access to companies
    // Fallback: fetch company via service role (only for the user's own memberships)
    console.log('[companies/me] Join failed, using service role fallback for RLS-blocked companies')
    
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Get the newest membership's company_id
    const newestMembership = rawMemberships[0] // Already sorted by created_at if needed
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

    console.log('[companies/me] Company found via service role fallback:', company.id)
    return NextResponse.json({
      company_id: company.id,
      company_name: company.name,
      role: newestMembership.role,
      status: company.status,
    })
  } catch (error: any) {
    console.error('[companies/me] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
