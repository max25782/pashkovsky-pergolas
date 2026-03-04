/**
 * Worker Timesheet PDF API Route
 * POST /api/workers/[id]/pdf?month=YYYY-MM
 * Generates a monthly attendance/pay report PDF for a worker
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { renderHtmlToPdfBuffer } from '@/lib/pdf/render-html-to-pdf'
import { generateWorkerTimesheetHtml } from '@/lib/pdf/worker-timesheet-html-template'
import { uploadToS3 } from '@/lib/s3-upload'
import { computeMinutesWorked, computeShiftCost } from '@/lib/workers/calculations'
import type { WorkerShift, WorkerShiftSummary, WorkerShiftType } from '@/types/workers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
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
  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month (YYYY-MM) is required' }, { status: 400 })
  }

  try {
    // Fetch worker
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('id, company_id, first_name, last_name, phone, role, daily_rate, hourly_rate, is_active')
      .eq('id', workerId)
      .single()

    if (workerError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    const access = await requireCompanyAccess(req, worker.company_id)
    if (!access.authorized) return access.error

    // Fetch shifts for the month
    const [year, monthNum] = month.split('-').map(Number)
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
    const lastDay = new Date(year, monthNum, 0).getDate()
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const { data: rows, error: shiftsError } = await supabase
      .from('worker_shifts')
      .select(`*, deal:deals(id, customer_name, customer_city, project_address)`)
      .eq('worker_id', workerId)
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('shift_date', { ascending: true })

    if (shiftsError) {
      console.error('[Worker PDF] Error fetching shifts:', shiftsError)
      return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
    }

    const shifts: WorkerShift[] = (rows || []).map(transformShiftFromDB)

    // Build summary
    const workShifts = shifts.filter((s) => s.shiftType === 'work')
    const holidayShifts = shifts.filter((s) => s.shiftType === 'holiday')
    const totalMinutes = workShifts.reduce((sum, s) => sum + (s.minutesWorked ?? 0), 0)
    const workCost = workShifts.reduce((sum, s) => sum + (s.computedCost ?? 0), 0)
    const holidayPay = holidayShifts.reduce((sum, s) => sum + (s.computedCost ?? 0), 0)

    const summary: WorkerShiftSummary = {
      daysWorked: workShifts.length,
      holidayDays: holidayShifts.length,
      dayOffDays: shifts.filter((s) => s.shiftType === 'day_off').length,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      totalCost: workCost,
      holidayPay,
      totalPayable: workCost + holidayPay,
      lateDaysCount: workShifts.filter((s) => {
        if (!s.endTime) return false
        const [h] = s.endTime.split(':').map(Number)
        return h >= 19
      }).length,
    }

    // Generate HTML → PDF
    const html = generateWorkerTimesheetHtml({
      worker: {
        id: worker.id,
        firstName: worker.first_name,
        lastName: worker.last_name,
        phone: worker.phone,
        role: worker.role,
        dailyRate: parseFloat(worker.daily_rate),
        hourlyRate: worker.hourly_rate != null ? parseFloat(worker.hourly_rate) : null,
      },
      month,
      shifts,
      summary,
    })

    const pdfBuffer = await renderHtmlToPdfBuffer(html)

    // Upload to S3
    const workerSlug = `${worker.first_name}-${worker.last_name}`.replace(/\s+/g, '-').toLowerCase()
    const filename = `timesheet-${workerSlug}-${month}.pdf`
    const key = `workers/${workerId}/timesheets/${filename}`
    const pdfUrl = await uploadToS3(pdfBuffer, key, 'application/pdf')

    return NextResponse.json({ pdfUrl })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Worker PDF] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
