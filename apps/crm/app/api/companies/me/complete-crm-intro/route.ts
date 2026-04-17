import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: memberships, error: membershipsError } = await service
      .from('company_members')
      .select('company_id, companies(created_at)')
      .eq('user_id', user.id)
      .order('created_at', { referencedTable: 'companies', ascending: true })
      .limit(1)

    if (membershipsError || !memberships?.length) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = memberships[0].company_id as string
    const completedAt = new Date().toISOString()

    const { error: updateError } = await service
      .from('company_members')
      .update({ crm_intro_completed_at: completedAt })
      .eq('user_id', user.id)
      .eq('company_id', companyId)

    if (updateError) {
      console.error('[complete-crm-intro] update error:', updateError)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, crm_intro_completed_at: completedAt })
  } catch (e) {
    console.error('[complete-crm-intro]', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
