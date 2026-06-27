/**
 * API route for individual worker shift
 * PATCH: Update shift
 * DELETE: Delete shift
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { WorkerShiftDraft, WorkerShiftType } from '@/types/workers'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { computeMinutesWorked, computeShiftCost } from '@/lib/workers/calculations'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function transformShiftFromDB(row: any) {
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

// PATCH - Update shift
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; shiftId: string }> }
) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { id: workerId, shiftId } = await context.params

  try {
    const body = (await req.json()) as Partial<WorkerShiftDraft>
    const { date, shiftType, dealId, projectName, startTime, endTime, note } = body

    const { data: shift, error: shiftError } = await supabase
      .from('worker_shifts')
      .select('id, worker_id, company_id')
      .eq('id', shiftId)
      .eq('worker_id', workerId)
      .single()

    if (shiftError || !shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const access = await requireCompanyAccess(req, shift.company_id)
    if (!access.authorized) return access.error

    const validTypes: WorkerShiftType[] = ['work', 'holiday', 'day_off']
    const resolvedType: WorkerShiftType | undefined =
      shiftType && validTypes.includes(shiftType) ? shiftType : undefined

    const isWorkShift = resolvedType === undefined ? undefined : resolvedType === 'work'

    const hasStart = (isWorkShift !== false) && startTime != null && startTime !== ''
    const hasEnd = (isWorkShift !== false) && endTime != null && endTime !== ''
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

    const { data: worker } = await supabase
      .from('workers')
      .select('daily_rate, hourly_rate')
      .eq('id', workerId)
      .single()

    const updates: Record<string, unknown> = {}
    if (date !== undefined) updates.shift_date = date
    if (resolvedType !== undefined) updates.shift_type = resolvedType
    if (note !== undefined) updates.note = note || null

    if (resolvedType === 'holiday' && worker) {
      // Holiday = full daily rate, clear time fields
      updates.deal_id = null
      updates.project_name = null
      updates.start_time = null
      updates.end_time = null
      updates.minutes_worked = null
      updates.computed_cost = parseFloat(worker.daily_rate)
    } else if (resolvedType === 'day_off') {
      // Day off = no pay, clear time fields
      updates.deal_id = null
      updates.project_name = null
      updates.start_time = null
      updates.end_time = null
      updates.minutes_worked = null
      updates.computed_cost = 0
    } else {
      // Work shift
      if (dealId !== undefined) updates.deal_id = dealId || null
      if (projectName !== undefined) updates.project_name = projectName?.trim() || null
      if (startTime !== undefined) updates.start_time = startTime || null
      if (endTime !== undefined) updates.end_time = endTime || null

      if (hasStart && hasEnd && worker) {
        const minutesWorked = computeMinutesWorked(startTime!, endTime!)
        const computedCost = computeShiftCost(
          minutesWorked ?? 0,
          parseFloat(worker.daily_rate),
          worker.hourly_rate != null ? parseFloat(worker.hourly_rate) : null
        )
        updates.minutes_worked = minutesWorked
        updates.computed_cost = computedCost
      } else if (!hasStart && !hasEnd) {
        updates.minutes_worked = null
        updates.computed_cost = null
      }
    }

    const { data, error } = await supabase
      .from('worker_shifts')
      .update(updates)
      .eq('id', shiftId)
      .select(
        `
        *,
        deal:deals(id, customer_name, customer_city, project_address)
      `
      )
      .single()

    if (error) {
      console.error('Error updating worker shift:', error)
      return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
    }

    return NextResponse.json({ shift: transformShiftFromDB(data) })
  } catch (err: unknown) {
    console.error('Error in PATCH /api/workers/[id]/shifts/[shiftId]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete shift
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; shiftId: string }> }
) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const { id: workerId, shiftId } = await context.params

  try {
    const { data: shift, error: shiftError } = await supabase
      .from('worker_shifts')
      .select('id, company_id')
      .eq('id', shiftId)
      .eq('worker_id', workerId)
      .single()

    if (shiftError || !shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }

    const access = await requireCompanyAccess(req, shift.company_id)
    if (!access.authorized) return access.error

    const { error: deleteError } = await supabase
      .from('worker_shifts')
      .delete()
      .eq('id', shiftId)

    if (deleteError) {
      console.error('Error deleting worker shift:', deleteError)
      return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Error in DELETE /api/workers/[id]/shifts/[shiftId]:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
