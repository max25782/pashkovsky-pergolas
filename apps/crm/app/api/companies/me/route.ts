import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export const dynamic = 'force-dynamic'

type Membership = {
  company_id: string
  role: string
  companies: {
    name: string
    created_at: string
    status: string
  }
}

export async function GET() {
  console.log('[companies/me] Route called')
  try {
    const supabase = createClient()

    // 1. Получаем текущего пользователя
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log('[companies/me] Unauthorized:', userError?.message || 'No user')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[companies/me] User:', user.email)

    // Check if user is SuperAdmin (they might not have company memberships)
    const isAdmin = await isSuperAdmin(user.id)
    if (isAdmin) {
      console.log('[companies/me] SuperAdmin detected, fetching first available company for testing...')
      // For SuperAdmin, return the first company (for testing/debugging purposes)
      const { data: firstCompany, error: companyError } = await supabase
        .from('companies')
        .select('id, name, created_at, status')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (companyError || !firstCompany) {
        console.log('[companies/me] No companies found in database')
        return NextResponse.json(
          { error: 'No companies available' },
          { status: 404 }
        )
      }

      console.log('[companies/me] Returning first company for SuperAdmin:', firstCompany.name)
      return NextResponse.json(
        {
          company_id: firstCompany.id,
          company_name: firstCompany.name,
          role: 'superadmin',
          status: firstCompany.status,
          is_superadmin_fallback: true, // Flag to indicate this is a fallback
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    // 2. Получаем все компании, где состоит пользователь
    console.log('[companies/me] Fetching memberships for user_id:', user.id)
    
    // First, get raw memberships (without join)
    const { data: rawMemberships, error: rawError } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)

    if (rawError) {
      console.error('[companies/me] rawError:', JSON.stringify(rawError, null, 2))
      return NextResponse.json(
        { error: 'Failed to load company memberships' },
        { status: 500 }
      )
    }

    if (!rawMemberships || rawMemberships.length === 0) {
      console.log('[companies/me] No memberships found for user:', user.email)
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    console.log('[companies/me] Raw memberships found:', rawMemberships.length)

    // Try to get companies with left join (companies may be null if RLS blocks access)
    const { data: membershipsWithCompanies, error: memberError } = await supabase
      .from('company_members')
      .select(
        `
          company_id,
          role,
          companies (
            name,
            created_at,
            status
          )
        `
      )
      .eq('user_id', user.id) as { data: Array<{
        company_id: string
        role: string
        companies: {
          name: string
          created_at: string
          status: string
        } | null
      }> | null; error: any }

    // If companies are inaccessible via RLS, fetch them using service role (for SuperAdmin or fallback)
    let memberships: Membership[] = []
    
    if (memberError || !membershipsWithCompanies) {
      console.log('[companies/me] Companies inaccessible via RLS, fetching with service role...')
      
      // Use service role to fetch companies
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const serviceSupabase = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )

      // Fetch companies for each membership
      for (const membership of rawMemberships) {
        const { data: company, error: companyError } = await serviceSupabase
          .from('companies')
          .select('name, created_at, status')
          .eq('id', membership.company_id)
          .single()

        if (!companyError && company) {
          memberships.push({
            company_id: membership.company_id,
            role: membership.role,
            companies: company,
          })
        } else {
          console.log(`[companies/me] Company ${membership.company_id} not found or inaccessible`)
        }
      }
    } else {
      // Filter out memberships where company is null (inaccessible via RLS)
      memberships = membershipsWithCompanies
        .filter((m): m is Membership => m.companies !== null)
        .map((m) => ({
          company_id: m.company_id,
          role: m.role,
          companies: m.companies!,
        }))
    }

    if (memberships.length === 0) {
      console.log('[companies/me] No accessible companies found for user:', user.email)
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    console.log('[companies/me] Accessible memberships:', memberships.length)

    // 3. Выбираем самую новую компанию, где пользователь owner,
    // иначе просто самую новую компанию
    const owners = memberships.filter((m) => m.role === 'owner')
    const candidates = owners.length > 0 ? owners : memberships

    candidates.sort((a, b) => {
      const da = new Date(a.companies.created_at).getTime()
      const db = new Date(b.companies.created_at).getTime()
      return db - da
    })

    const selected = candidates[0]
    console.log('[companies/me] Selected company:', selected.company_id, selected.companies.name)

    return NextResponse.json(
      {
        company_id: selected.company_id,
        company_name: selected.companies.name,
        role: selected.role,
        status: selected.companies.status,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error: any) {
    console.error('[companies/me] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

