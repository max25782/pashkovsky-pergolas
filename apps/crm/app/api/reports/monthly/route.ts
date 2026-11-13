/**
 * API route for monthly reports
 *
 * Auth: session required. Owner and admin of the caller's company only.
 * Every query is scoped to that company_id; no cross-tenant data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { MonthlyReport } from '@/types/workers'
import { buildMoneyMonthReport, buildPaymentsByDeal, type RevenueDeal } from '@/lib/deals/revenue'
import { requirePermissionAsync } from '@/lib/middleware/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

const DEAL_COLS = 'id, customer_name, customer_type, stage, price, my_cost, installation_date, order_date, created_at'

export async function GET(req: NextRequest) {
  // reports:export = owner and admin only (managers must not see every firm's money).
  const permission = await requirePermissionAsync(req, 'reports:export')
  if (!permission.authorized) return permission.error as NextResponse
  const companyId = permission.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Unauthorized: No company context' }, { status: 401 })
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM

  try {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'month parameter is required in YYYY-MM format' },
        { status: 400 },
      )
    }

    const [year, monthNum] = month.split('-').map(Number)
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0]

    const { data: doneDeals, error: dealsError } = await supabase
      .from('deals')
      .select(DEAL_COLS)
      .eq('company_id', companyId)
      .eq('stage', 'done')
      .not('installation_date', 'is', null)
      .gte('installation_date', `${startDate}T00:00:00.000Z`)
      .lte('installation_date', `${endDate}T23:59:59.999Z`)

    if (dealsError) {
      console.error('Error fetching deals:', dealsError)
      return NextResponse.json({
        error: 'Failed to fetch deals',
        details: dealsError.message,
      }, { status: 500 })
    }

    const { data: contractorDeals, error: contractorError } = await supabase
      .from('deals')
      .select(DEAL_COLS)
      .eq('company_id', companyId)
      .eq('customer_type', 'contractor')
      .lte('created_at', '9999-12-31T23:59:59.000Z')

    if (contractorError) {
      console.error('Error fetching contractor deals:', contractorError)
      return NextResponse.json({
        error: 'Failed to fetch deals',
        details: contractorError.message,
      }, { status: 500 })
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('deal_payments')
      .select('deal_id, amount, paid_at')
      .eq('company_id', companyId)
      .gte('paid_at', `${startDate}T00:00:00.000Z`)
      .lte('paid_at', `${endDate}T23:59:59.999Z`)

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError)
      return NextResponse.json({
        error: 'Failed to fetch payments',
        details: paymentsError.message,
      }, { status: 500 })
    }

    const byId = new Map<string, RevenueDeal>()
    for (const deal of [...(doneDeals ?? []), ...(contractorDeals ?? [])]) {
      byId.set(deal.id, deal as RevenueDeal)
    }

    const report: MonthlyReport = buildMoneyMonthReport(
      Array.from(byId.values()),
      month,
      buildPaymentsByDeal(payments ?? []),
    )

    return NextResponse.json({ report })
  } catch (error: unknown) {
    const e = error instanceof Error ? error : null
    console.error('Error in GET /api/reports/monthly:', {
      error: e?.message ?? String(error),
      stack: e?.stack?.substring(0, 500),
      month,
    })
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: e?.message ?? String(error),
        month,
      },
      { status: 500 },
    )
  }
}
