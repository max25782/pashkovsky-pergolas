/**
 * GET /api/workers/pension?month=YYYY-MM
 * Pension and pitzuim owed for the shifts of one month, per worker and in
 * total. Same function as the Tazrim row, so both show one number.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getUserContextAsync } from '@/lib/middleware/company-context'
import { loadCompanyShifts, loadWorkerCostBook } from '@/lib/workers/load-cost-book'
import { buildMonthPensionReport, type PensionReport } from '@/lib/workers/pension-report'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export type PensionReportResponse = PensionReport

export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const month = new URL(req.url).searchParams.get('month') ?? ''
  if (!MONTH_PATTERN.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }

  const userContext = await getUserContextAsync(req)
  const companyId = userContext?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    const [book, shifts] = await Promise.all([
      loadWorkerCostBook(supabase, companyId),
      loadCompanyShifts(supabase, companyId, { fromDate: `${month}-01` }),
    ])
    const body: PensionReportResponse = buildMonthPensionReport(shifts, book, month)
    return NextResponse.json(body)
  } catch (error) {
    console.error('Error in GET /api/workers/pension:', error)
    return NextResponse.json({ error: 'Failed to build the pension report' }, { status: 500 })
  }
}
