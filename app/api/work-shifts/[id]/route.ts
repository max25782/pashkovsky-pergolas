/**
 * API route for managing individual work shift
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { WorkShift } from '@/types/workers'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// Transform DB row to WorkShift
function transformWorkShiftFromDB(row: any): WorkShift {
  return {
    id: row.id,
    projectId: row.project_id,
    workerId: row.worker_id,
    date: row.date,
    payType: row.pay_type,
    dailyRateSnapshot: parseFloat(row.daily_rate_snapshot),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    worker: row.worker ? {
      id: row.worker.id,
      firstName: row.worker.first_name,
      lastName: row.worker.last_name,
      phone: row.worker.phone,
      role: row.worker.role,
      dailyRate: parseFloat(row.worker.daily_rate),
      isActive: row.worker.is_active,
      createdAt: row.worker.created_at,
      updatedAt: row.worker.updated_at,
    } : undefined,
  }
}

// PATCH - Update work shift
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const updates: any = {}

    if (body.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json(
          { error: 'date must be in YYYY-MM-DD format' },
          { status: 400 }
        )
      }
      updates.date = body.date
    }
    if (body.dailyRateSnapshot !== undefined) {
      if (body.dailyRateSnapshot <= 0) {
        return NextResponse.json(
          { error: 'dailyRateSnapshot must be greater than 0' },
          { status: 400 }
        )
      }
      updates.daily_rate_snapshot = body.dailyRateSnapshot
    }
    if (body.notes !== undefined) updates.notes = body.notes || null

    const { data, error } = await supabase
      .from('work_shifts')
      .update(updates)
      .eq('id', params.id)
      .select(`
        *,
        worker:workers(*)
      `)
      .single()

    if (error) {
      console.error('Error updating work shift:', error)
      return NextResponse.json({ error: 'Failed to update work shift' }, { status: 500 })
    }

    return NextResponse.json({ shift: transformWorkShiftFromDB(data) })
  } catch (error: any) {
    console.error('Error in PATCH /api/work-shifts/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Delete work shift
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { error } = await supabase
      .from('work_shifts')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting work shift:', error)
      return NextResponse.json({ error: 'Failed to delete work shift' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/work-shifts/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

