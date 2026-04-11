/**
 * GET /api/admin/dashboard-stats
 * Returns active deals, new leads (30 days), active workers for the user's company.
 * Uses service role to bypass RLS - auth and company_id are validated first.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { assertUserHasFeature } from '@/lib/subscription/require-feature-api'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'No company context' }, { status: 401 })
  }

  const access = await requireCompanyAccess(req, companyId)
  if (!access.authorized) return access.error

  const planBlock = await assertUserHasFeature(authCheck.user.id, 'crm_home')
  if (planBlock) return planBlock

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Active deals: only where material was ordered (material_ordered, approved, production, install)
    const [activeDealsRes, newLeadsRes, activeWorkersRes] = await Promise.all([
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('stage', ['material_ordered', 'approved', 'production', 'install']),
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('workers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true),
    ])

    return NextResponse.json({
      activeDeals: activeDealsRes.count ?? 0,
      newLeads: newLeadsRes.count ?? 0,
      activeWorkers: activeWorkersRes.count ?? 0,
    })
  } catch (err) {
    console.error('[dashboard-stats] Error:', err)
    return NextResponse.json(
      { error: 'Failed to load stats' },
      { status: 500 }
    )
  }
}
