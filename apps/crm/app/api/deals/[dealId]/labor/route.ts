/**
 * API route for deal labor from worker_shifts
 * GET: Returns totalCost, totalMinutes, and optionally shifts list
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { computeShiftCost } from '@/lib/workers/calculations'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function liveComputedCost(row: {
  shift_type?: string | null
  minutes_worked?: number | null
  computed_cost?: unknown
  worker?: { daily_rate?: string | number; hourly_rate?: string | number | null } | null
}): number {
  const w = row.worker
  if (!w) {
    return row.computed_cost != null ? parseFloat(String(row.computed_cost)) : 0
  }
  const dr = parseFloat(String(w.daily_rate ?? '0'))
  const hrRaw = w.hourly_rate
  const hr = hrRaw != null && hrRaw !== '' ? parseFloat(String(hrRaw)) : null
  const type = row.shift_type ?? 'work'
  if (type === 'holiday') return dr
  if (type === 'day_off') return 0
  const mins = row.minutes_worked
  if (mins != null && mins >= 0) {
    return computeShiftCost(mins, dr, hr)
  }
  return row.computed_cost != null ? parseFloat(String(row.computed_cost)) : 0
}

function transformShift(row: any) {
  return {
    id: row.id,
    workerId: row.worker_id,
    dealId: row.deal_id,
    shiftDate: row.shift_date,
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    minutesWorked: row.minutes_worked,
    computedCost: liveComputedCost(row),
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

    // Always join worker rates so liveComputedCost can calculate correctly.
    // When includeShifts=true we also return name/role for the full shifts list.
    const selectFields = includeShifts
      ? '*, worker:workers(id, first_name, last_name, role, daily_rate, hourly_rate)'
      : '*, worker:workers(daily_rate, hourly_rate)'

    const { data: shiftsRaw, error } = await supabase
      .from('worker_shifts')
      .select(selectFields)
      .eq('deal_id', dealId)
      .order('shift_date', { ascending: false })

    if (error) {
      console.error('Error fetching deal labor:', error)
      return NextResponse.json({ error: 'Failed to fetch labor' }, { status: 500 })
    }

    const shifts: any[] = shiftsRaw || []

    const totalCost = shifts.reduce((sum: number, s: any) => sum + liveComputedCost(s), 0)
    const totalMinutes = shifts.reduce(
      (sum: number, s: any) => sum + (s.minutes_worked ?? 0),
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
