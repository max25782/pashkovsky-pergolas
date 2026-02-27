/**
 * API route for deal labor from worker_shifts
 * GET: Returns totalCost, totalMinutes, and optionally shifts list
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function transformShift(row: any) {
  return {
    id: row.id,
    workerId: row.worker_id,
    dealId: row.deal_id,
    shiftDate: row.shift_date,
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    minutesWorked: row.minutes_worked,
    computedCost: row.computed_cost != null ? parseFloat(row.computed_cost) : null,
    note: row.note,
    worker: row.worker
      ? {
          id: row.worker.id,
          firstName: row.worker.first_name,
          lastName: row.worker.last_name,
          role: row.worker.role,
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

    const selectFields = includeShifts
      ? '*, worker:workers(id, first_name, last_name, role)'
      : 'computed_cost, minutes_worked'

    const { data: shifts, error } = await supabase
      .from('worker_shifts')
      .select(selectFields)
      .eq('deal_id', dealId)
      .order('shift_date', { ascending: false })

    if (error) {
      console.error('Error fetching deal labor:', error)
      return NextResponse.json({ error: 'Failed to fetch labor' }, { status: 500 })
    }

    const totalCost = (shifts || []).reduce(
      (sum, s) => sum + (s.computed_cost != null ? parseFloat(String(s.computed_cost)) : 0),
      0
    )
    const totalMinutes = (shifts || []).reduce(
      (sum, s) => sum + (s.minutes_worked ?? 0),
      0
    )

    const result: { totalCost: number; totalMinutes: number; shifts?: unknown[] } = {
      totalCost,
      totalMinutes,
    }
    if (includeShifts && shifts) {
      result.shifts = shifts.map(transformShift)
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
