/**
 * API route for bulk shift upsert
 * POST: Apply same shift to multiple workers
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { computeMinutesWorked, computeShiftCost } from '@/lib/workers/calculations'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

interface BulkShiftBody {
  date: string
  deal_id?: string | null
  start_time?: string | null
  end_time?: string | null
  worker_ids: string[]
}

export async function POST(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const body = (await req.json()) as BulkShiftBody
    const { date, deal_id, start_time, end_time, worker_ids } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 })
    }

    if (!Array.isArray(worker_ids) || worker_ids.length === 0) {
      return NextResponse.json({ error: 'worker_ids array is required and must not be empty' }, { status: 400 })
    }

    const hasStart = start_time != null && start_time !== ''
    const hasEnd = end_time != null && end_time !== ''
    if (hasStart !== hasEnd) {
      return NextResponse.json(
        { error: 'Both start_time and end_time are required when one is provided' },
        { status: 400 }
      )
    }

    let minutesWorked: number | null = null
    if (hasStart && hasEnd) {
      minutesWorked = computeMinutesWorked(start_time!, end_time!)
      if (minutesWorked === null || minutesWorked < 0) {
        return NextResponse.json(
          { error: 'Invalid times: end must be after start (no overnight shifts)' },
          { status: 400 }
        )
      }
    }

    const { data: workers, error: workersError } = await supabase
      .from('workers')
      .select('id, company_id, daily_rate, hourly_rate')
      .in('id', worker_ids)

    if (workersError || !workers || workers.length === 0) {
      return NextResponse.json({ error: 'Workers not found' }, { status: 404 })
    }

    const companyId = workers[0].company_id
    const access = await requireCompanyAccess(req, companyId)
    if (!access.authorized) return access.error

    const allSameCompany = workers.every((w) => w.company_id === companyId)
    if (!allSameCompany) {
      return NextResponse.json({ error: 'All workers must belong to the same company' }, { status: 400 })
    }

    const rows = workers.map((worker) => {
      let computedCost: number | null = null
      if (minutesWorked != null && minutesWorked > 0) {
        computedCost = computeShiftCost(
          minutesWorked,
          parseFloat(worker.daily_rate),
          worker.hourly_rate != null ? parseFloat(worker.hourly_rate) : null
        )
      }
      return {
        company_id: companyId,
        worker_id: worker.id,
        deal_id: deal_id || null,
        shift_date: date,
        start_time: start_time || null,
        end_time: end_time || null,
        minutes_worked: minutesWorked,
        computed_cost: computedCost,
        note: null,
      }
    })

    const { data, error } = await supabase
      .from('worker_shifts')
      .upsert(rows, {
        onConflict: 'company_id,worker_id,shift_date',
        ignoreDuplicates: false,
      })
      .select('id')

    if (error) {
      console.error('Error bulk upserting worker shifts:', error)
      return NextResponse.json({ error: 'Failed to save shifts' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: data?.length ?? rows.length })
  } catch (err: unknown) {
    console.error('Error in POST /api/shifts/bulk:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
