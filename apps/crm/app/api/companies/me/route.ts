import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = await isSuperAdmin(user.id)

  if (admin) {
    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: company, error: companyError } = await service
      .from('companies')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

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

  const { data: membership, error } = await supabase
    .from('company_members')
    .select(`
      role,
      companies!inner (
        id,
        name,
        status,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error || !membership) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // TypeScript sees companies as array due to join, but with !inner and single() it's actually an object
  const companies = membership.companies as unknown as { id: string; name: string; status: string; created_at: string } | null

  if (!companies) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  return NextResponse.json({
    company_id: companies.id,
    company_name: companies.name,
    role: membership.role,
    status: companies.status,
  })
}
