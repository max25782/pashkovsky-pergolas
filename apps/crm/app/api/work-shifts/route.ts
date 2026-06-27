/**
 * API route for managing work shifts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { WorkShift } from '@/types/workers'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'

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

// GET - List work shifts for a project
export async function GET(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // 🔒 Security: Verify project (deal) belongs to user's company
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('company_id')
      .eq('id', projectId)
      .single()

    if (dealError || !deal) {
      console.error('Error fetching deal:', dealError)
      return NextResponse.json(
        { error: 'Deal not found or access denied' },
        { status: 404 }
      )
    }

    // Verify company access
    const access = await requireCompanyAccess(req, deal.company_id)
    if (!access.authorized) return access.error

    // Now safe to fetch work shifts
    const { data, error } = await supabase
      .from('work_shifts')
      .select(`
        *,
        worker:workers(*)
      `)
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching work shifts:', error)
      return NextResponse.json({ error: 'Failed to fetch work shifts' }, { status: 500 })
    }

    const shifts = (data || []).map(transformWorkShiftFromDB)
    return NextResponse.json({ shifts })
  } catch (error: unknown) {
    console.error('Error in GET /api/work-shifts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new work shift
export async function POST(req: NextRequest) {
  // 🔒 Security: Require authentication
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { projectId, workerId, date, payType = 'daily', dailyRateSnapshot, notes } = body

    if (!projectId || !workerId || !date || !dailyRateSnapshot) {
      return NextResponse.json(
        { error: 'projectId, workerId, date, and dailyRateSnapshot are required' },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    // 🔒 Security: Verify project (deal) belongs to user's company
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('company_id')
      .eq('id', projectId)
      .single()

    if (dealError || !deal) {
      console.error('Error fetching deal:', dealError)
      return NextResponse.json(
        { error: 'Deal not found or access denied' },
        { status: 404 }
      )
    }

    const access = await requireCompanyAccess(req, deal.company_id)
    if (!access.authorized) return access.error

    // 🔒 Security: Verify worker belongs to user's company
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('company_id')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      console.error('Error fetching worker:', workerError)
      return NextResponse.json(
        { error: 'Worker not found or access denied' },
        { status: 404 }
      )
    }

    const workerAccess = await requireCompanyAccess(req, worker.company_id)
    if (!workerAccess.authorized) return workerAccess.error

    // Check if shift already exists for this worker/date/project
    const { data: existing } = await supabase
      .from('work_shifts')
      .select('id')
      .eq('project_id', projectId)
      .eq('worker_id', workerId)
      .eq('date', date)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Work shift already exists for this worker, date, and project' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase
      .from('work_shifts')
      .insert({
        project_id: projectId,
        worker_id: workerId,
        company_id: deal.company_id,
        date,
        pay_type: payType,
        daily_rate_snapshot: dailyRateSnapshot,
        notes: notes || null,
      })
      .select(`
        *,
        worker:workers(*)
      `)
      .single()

    if (error) {
      console.error('Error creating work shift:', error)
      return NextResponse.json({ error: 'Failed to create work shift' }, { status: 500 })
    }

    return NextResponse.json({ shift: transformWorkShiftFromDB(data) })
  } catch (error: unknown) {
    console.error('Error in POST /api/work-shifts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}






