/**
 * API route for deal labor from worker_shifts
 * GET: Returns totalCost, totalMinutes, and optionally shifts list.
 *
 * Cost is what the worker costs the employer: net rate x (1 + employer
 * coefficient), see lib/workers/employer-cost.ts. The timesheet PDF keeps the
 * net rate; only project cost uses the coefficient.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { roundMoney } from '@/lib/finance/money'
import { contextShiftCost } from '@/lib/workers/employer-cost'
import { loadWorkerCostBook, type WorkerCostBook } from '@/lib/workers/load-cost-book'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

interface ShiftDbRow {
  id: string
  worker_id: string
  deal_id: string | null
  shift_date: string
  start_time: string | null
  end_time: string | null
  minutes_worked: number | null
  computed_cost: unknown
  shift_type?: string | null
  note: string | null
}

function transformShift(row: ShiftDbRow, book: WorkerCostBook) {
  const worker = book.workers.get(row.worker_id)
  return {
    id: row.id,
    workerId: row.worker_id,
    dealId: row.deal_id,
    shiftDate: row.shift_date,
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    minutesWorked: row.minutes_worked,
    computedCost: contextShiftCost(
      { ...row, computed_cost: row.computed_cost as number | string | null },
      book.contextFor(row.worker_id),
    ),
    note: row.note,
    worker: worker
      ? {
          id: worker.id,
          firstName: worker.first_name,
          lastName: worker.last_name,
          role: worker.role,
        }
      : undefined,
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ dealId: string }> }
) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { dealId } = await context.params
  const { searchParams } = new URL(req.url)
  const includeShifts = searchParams.get('includeShifts') === 'true'

  try {
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, company_id')
      .eq('id', dealId)
      .single()

    if (dealError || !deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 })
    }

    const access = await requireCompanyAccess(req, deal.company_id)
    if (!access.authorized) return access.error

    const [shiftsResult, book] = await Promise.all([
      supabase
        .from('worker_shifts')
        .select('*')
        .eq('deal_id', dealId)
        .order('shift_date', { ascending: false }),
      loadWorkerCostBook(supabase, deal.company_id),
    ])

    if (shiftsResult.error) {
      console.error('Error fetching deal labor:', shiftsResult.error)
      return NextResponse.json({ error: 'Failed to fetch labor' }, { status: 500 })
    }

    const shifts = (shiftsResult.data ?? []) as ShiftDbRow[]

    const totalCost = roundMoney(
      shifts.reduce(
        (sum, s) =>
          sum +
          contextShiftCost(
            { ...s, computed_cost: s.computed_cost as number | string | null },
            book.contextFor(s.worker_id),
          ),
        0,
      ),
    )
    const totalMinutes = shifts.reduce((sum, s) => sum + (s.minutes_worked ?? 0), 0)

    const result: { totalCost: number; totalMinutes: number; shifts?: unknown[] } = {
      totalCost,
      totalMinutes,
    }
    if (includeShifts) {
      result.shifts = shifts.map((s) => transformShift(s, book))
    }

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('Error in GET /api/deals/[dealId]/labor:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}
