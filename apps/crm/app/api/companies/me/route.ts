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


    // Use service role to fetch memberships with company data (bypasses RLS)
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: memberships, error: membershipsError } = await service
      .from('company_members')
      .select('role, company_id, companies(id, name, status, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { referencedTable: 'companies', ascending: true })
      .limit(1)

    if (membershipsError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const chosen = memberships[0]
    const company = chosen.companies as unknown as Company
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    return NextResponse.json({
      company_id: company.id,
      company_name: company.name,
      role: chosen.role,
      status: company.status,
    })
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
