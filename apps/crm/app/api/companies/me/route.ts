import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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
  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await isSuperAdmin(user.id)

  // --- SuperAdmin: use service role ---
  if (admin) {
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
      return NextResponse.json({ error: 'No companies available' }, { status: 404 })
    }

    return NextResponse.json({
      company_id: company.id,
      company_name: company.name,
      role: 'superadmin',
      status: company.status,
    })
  }

  // --- Normal user: enforce RLS only ---
  const { data, error } = await supabase
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
    // pick newest company
    .order('created_at', { foreignTable: 'companies', ascending: false })
    .limit(1)
    .single<MembershipWithCompany>()

  if (error || !data) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // TypeScript knows companies is Company (not array) due to !inner and single()
  const company = data.companies

  return NextResponse.json({
    company_id: company.id,
    company_name: company.name,
    role: data.role,
    status: company.status,
  })
}
