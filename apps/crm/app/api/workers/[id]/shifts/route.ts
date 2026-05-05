/**
 * API route for worker shifts (timesheets)
 * GET: List shifts for worker by month
 * POST: Create/upsert shift
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { WorkerShift, WorkerShiftSummary, WorkerShiftDraft, WorkerShiftType } from '@/types/workers'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { computeMinutesWorked, computeShiftCost, applyCurrentRatesToWorkerShifts } from '@/lib/workers/calculations'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function transformShiftFromDB(row: any): WorkerShift {
  const deal = row.deal
  return {
    id: row.id,
    workerId: row.worker_id,
    dealId: row.deal_id,
    projectName: row.project_name ?? null,
    shiftDate: row.shift_date,
    shiftType: (row.shift_type as WorkerShiftType) ?? 'work',
    startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
    endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
    minutesWorked: row.minutes_worked,
    computedCost: row.computed_cost != null ? parseFloat(row.computed_cost) : null,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deal: deal
      ? {
          id: deal.id,
          customerName: deal.customer_name,
          customerCity: deal.customer_city,
          projectAddress: deal.project_address,
        }
      : undefined,
  }
}

function computeLateFinish(endTime: string | null): boolean {
  if (!endTime) return false
  const [h] = endTime.split(':').map(Number)
  return h >= 19
}

function parseAvgFinishTime(shifts: WorkerShift[]): string | undefined {
  const withEnd = shifts.filter((s) => s.endTime)
  if (withEnd.length === 0) return undefined
  let totalMin = 0
  for (const s of withEnd) {
    const [h, m] = (s.endTime ?? '00:00').split(':').map(Number)
    totalMin += h * 60 + m
  }
  const avgMin = Math.round(totalMin / withEnd.length)
  const h = Math.floor(avgMin / 60)
  const m = avgMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// GET - List shifts for worker by month
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { id: workerId } = await context.params
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month (YYYY-MM) is required' }, { status: 400 })
  }

  const [year, monthNum] = month.split('-').map(Number)
  const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
  const lastDay = new Date(year, monthNum, 0).getDate()
  const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  try {
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, company_id, daily_rate, hourly_rate')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    const access = await requireCompanyAccess(req, worker.company_id)
    if (!access.authorized) return access.error

    const { data: rows, error } = await supabase
      .from('worker_shifts')
      .select(
        `
        *,
        deal:deals(id, customer_name, customer_city, project_address)
      `
      )
      .eq('worker_id', workerId)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('shift_date', { ascending: false })

    if (error) {
      console.error('Error fetching worker shifts:', error)
      return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
    }

    const shiftsRaw: WorkerShift[] = (rows || []).map(transformShiftFromDB)
    const dailyRate = parseFloat(worker.daily_rate)
    const hourlyParsed =
      worker.hourly_rate != null && worker.hourly_rate !== ''
        ? parseFloat(worker.hourly_rate)
        : null
    const shifts = applyCurrentRatesToWorkerShifts(shiftsRaw, dailyRate, hourlyParsed)

    const workShifts = shifts.filter((s) => s.shiftType === 'work')
    const holidayShifts = shifts.filter((s) => s.shiftType === 'holiday')
    const totalMinutes = workShifts.reduce((sum, s) => sum + (s.minutesWorked ?? 0), 0)
    // Work cost + holiday pay (daily rate per holiday day); day_off = no pay
    const workCost = workShifts.reduce((sum, s) => sum + (s.computedCost ?? 0), 0)
    const holidayPay = holidayShifts.reduce((sum, s) => sum + (s.computedCost ?? 0), 0)
    const lateDaysCount = workShifts.filter((s) => computeLateFinish(s.endTime)).length

    const summary: WorkerShiftSummary = {
      daysWorked: workShifts.length,
      holidayDays: holidayShifts.length,
      dayOffDays: shifts.filter((s) => s.shiftType === 'day_off').length,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      totalCost: workCost,
      holidayPay,
      totalPayable: workCost + holidayPay,
      lateDaysCount,
      avgFinishTime: parseAvgFinishTime(workShifts),
    }

    return NextResponse.json({ summary, shifts })
  } catch (err: unknown) {
    console.error('Error in GET /api/workers/[id]/shifts:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}

// POST - Create/upsert shift
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { id: workerId } = await context.params

  try {
    const body = (await req.json()) as WorkerShiftDraft
    const { date, shiftType, dealId, projectName, startTime, endTime, note } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
    }

    const validTypes: WorkerShiftType[] = ['work', 'holiday', 'day_off']
    const resolvedType: WorkerShiftType = shiftType && validTypes.includes(shiftType) ? shiftType : 'work'

    const isWorkShift = resolvedType === 'work'

    const hasStart = isWorkShift && startTime != null && startTime !== ''
    const hasEnd = isWorkShift && endTime != null && endTime !== ''
    if (hasStart !== hasEnd) {
      return NextResponse.json(
        { error: 'Both start_time and end_time are required when one is provided' },
        { status: 400 }
      )
    }

    if (hasStart && hasEnd) {
      const minutes = computeMinutesWorked(startTime!, endTime!)
      if (minutes === null || minutes < 0) {
        return NextResponse.json(
          { error: 'Invalid times: end must be after start (no overnight shifts)' },
          { status: 400 }
        )
      }
    }

    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, company_id, daily_rate, hourly_rate')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    const access = await requireCompanyAccess(req, worker.company_id)
    if (!access.authorized) return access.error

    let minutesWorked: number | null = null
    let computedCost: number | null = null

    if (resolvedType === 'holiday') {
      // Holiday = full daily rate, no hours tracked
      computedCost = parseFloat(worker.daily_rate)
    } else if (resolvedType === 'day_off') {
      // Day off = no pay
      computedCost = 0
    } else if (hasStart && hasEnd) {
      minutesWorked = computeMinutesWorked(startTime!, endTime!) ?? null
      if (minutesWorked != null) {
        computedCost = computeShiftCost(
          minutesWorked,
          parseFloat(worker.daily_rate),
          worker.hourly_rate != null ? parseFloat(worker.hourly_rate) : null
        )
      }
    }

    const payload = {
      company_id: worker.company_id,
      worker_id: workerId,
      shift_type: resolvedType,
      deal_id: isWorkShift ? (dealId || null) : null,
      project_name: isWorkShift ? (projectName?.trim() || null) : null,
      shift_date: date,
      start_time: hasStart ? startTime : null,
      end_time: hasEnd ? endTime : null,
      minutes_worked: minutesWorked,
      computed_cost: computedCost,
      note: note || null,
    }

    const { data, error } = await supabase
      .from('worker_shifts')
      .upsert(payload, {
        onConflict: 'company_id,worker_id,shift_date',
        ignoreDuplicates: false,
      })
      .select(
        `
        *,
        deal:deals(id, customer_name, customer_city, project_address)
      `
      )
      .single()

    if (error) {
      console.error('Error upserting worker shift:', error)
      return NextResponse.json({ error: 'Failed to save shift' }, { status: 500 })
    }

    return NextResponse.json({ shift: transformShiftFromDB(data) })
  } catch (err: unknown) {
    console.error('Error in POST /api/workers/[id]/shifts:', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 }
    )
  }
}
