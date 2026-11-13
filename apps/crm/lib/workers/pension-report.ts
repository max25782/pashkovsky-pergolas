/**
 * Monthly "Pension and pitzuim" report: what the employer owes to pension
 * funds for the shifts of one calendar month, per worker and in total.
 *
 * Cash-flow only. The employer coefficient (25% by default) already contains
 * pension, so project cost is never reduced by these amounts. The same
 * function feeds the CRM screen and the Tazrim row, so both show one number.
 *
 * Pure: no React, no Supabase.
 */

import { roundMoney } from '@/lib/finance/money'
import { computeWorkerMonthPension } from '@/lib/workers/employer-cost'
import type { WorkerCostBook, WorkerShiftRow } from '@/lib/workers/load-cost-book'

export interface PensionReportRow {
  workerId: string
  workerName: string
  /** Employer gross for the month: shift costs with the employer coefficient. */
  gross: number
  /** Share of the month's gross, per day with that day's pension rate. */
  pension: number
  days: number
}

export interface PensionReport {
  /** YYYY-MM of the shifts. */
  month: string
  rows: PensionReportRow[]
  total: number
}

export function workerDisplayName(worker: { first_name?: string | null; last_name?: string | null }): string {
  return `${worker.first_name ?? ''} ${worker.last_name ?? ''}`.trim() || '—'
}

/**
 * Workers flagged "no pension" get no row. Shifts of workers that no longer
 * exist are not part of the report: there is no pension agreement to pay into.
 */
export function buildMonthPensionReport(
  shifts: readonly WorkerShiftRow[],
  book: Pick<WorkerCostBook, 'workers' | 'contextFor'>,
  month: string,
): PensionReport {
  const byWorker = new Map<string, WorkerShiftRow[]>()
  for (const shift of shifts) {
    if (!shift.shift_date || shift.shift_date.slice(0, 7) !== month) continue
    if (!book.workers.has(shift.worker_id)) continue
    const list = byWorker.get(shift.worker_id) ?? []
    list.push(shift)
    byWorker.set(shift.worker_id, list)
  }

  const rows: PensionReportRow[] = []
  for (const [workerId, workerShifts] of byWorker) {
    const worker = book.workers.get(workerId)
    if (!worker) continue
    const result = computeWorkerMonthPension(workerShifts, book.contextFor(workerId))
    if (result.exempt || result.pension <= 0) continue
    rows.push({
      workerId,
      workerName: workerDisplayName(worker),
      gross: result.gross,
      pension: result.pension,
      days: result.days,
    })
  }

  rows.sort((a, b) => a.workerName.localeCompare(b.workerName))
  return {
    month,
    rows,
    total: roundMoney(rows.reduce((sum, row) => sum + row.pension, 0)),
  }
}
