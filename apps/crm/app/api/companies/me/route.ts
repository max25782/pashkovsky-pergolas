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
    
    // First, try to get memberships with company data (inner join)
    const { data: memberships, error: memberError } = await supabase
      .from('company_members')
      .select(
        `
          company_id,
          role,
          companies!inner (
            name,
            created_at,
            status
          )
        `
      )
      .eq('user_id', user.id) as { data: Membership[] | null; error: any }

    if (memberError) {
      console.error('[companies/me] memberError:', JSON.stringify(memberError, null, 2))
      return NextResponse.json(
        { error: 'Failed to load company memberships' },
        { status: 500 }
      )
    }

    console.log('[companies/me] Memberships found (with inner join):', memberships?.length || 0)
    
    // If no memberships with inner join, try without join to see if memberships exist at all
    if (!memberships || memberships.length === 0) {
      console.log('[companies/me] No memberships with inner join, checking raw memberships...')
      const { data: rawMemberships, error: rawError } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
      
      console.log('[companies/me] Raw memberships (no join):', rawMemberships?.length || 0)
      if (rawMemberships && rawMemberships.length > 0) {
        console.log('[companies/me] Raw memberships:', JSON.stringify(rawMemberships, null, 2))
        console.log('[companies/me] WARNING: Memberships exist but companies are missing or inaccessible')
      }
      
      console.log('[companies/me] No memberships found for user:', user.email)
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (memberships && memberships.length > 0) {
      console.log('[companies/me] First membership:', JSON.stringify(memberships[0], null, 2))
    }

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

