import type { SupabaseClient } from '@supabase/supabase-js'
import {
  contextShiftCost,
  type ShiftForCost,
  type WorkerCostContext,
  type WorkerTermsChange,
  type WorkerTermsRow,
} from '@/lib/workers/employer-cost'
import { roundMoney } from '@/lib/finance/money'

/**
 * Server-side loader for everything needed to price worker shifts: the
 * workers (all columns, so the optional employer columns are used once the
 * migration is applied and defaults apply before) and their term changes.
 */

export interface WorkerRowWithName extends WorkerTermsRow {
  id: string
  first_name?: string | null
  last_name?: string | null
  role?: string | null
}

export interface WorkerCostBook {
  workers: Map<string, WorkerRowWithName>
  contextFor(workerId: string | null | undefined): WorkerCostContext
}

// Postgres "undefined_table" and PostgREST "table not in schema cache".
const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205'])

export async function loadWorkerCostBook(
  supabase: SupabaseClient,
  companyId: string,
): Promise<WorkerCostBook> {
  const [workersResult, changesResult] = await Promise.all([
    supabase.from('workers').select('*').eq('company_id', companyId),
    supabase.from('worker_rate_history').select('*').eq('company_id', companyId),
  ])

  if (workersResult.error) {
    throw new Error(`Failed to load workers: ${workersResult.error.message}`)
  }

  // The history table arrives with the (separately applied) migration. Until
  // then there is simply no history: terms are the current ones.
  let changeRows: Array<WorkerTermsChange & { worker_id: string }> = []
  if (changesResult.error) {
    if (!MISSING_TABLE_CODES.has(changesResult.error.code ?? '')) {
      throw new Error(`Failed to load worker_rate_history: ${changesResult.error.message}`)
    }
  } else {
    changeRows = (changesResult.data ?? []) as Array<WorkerTermsChange & { worker_id: string }>
  }

  const workers = new Map<string, WorkerRowWithName>(
    ((workersResult.data ?? []) as WorkerRowWithName[]).map((w) => [w.id, w]),
  )
  const changesByWorker = new Map<string, WorkerTermsChange[]>()
  for (const change of changeRows) {
    const list = changesByWorker.get(change.worker_id) ?? []
    list.push(change)
    changesByWorker.set(change.worker_id, list)
  }

  return {
    workers,
    contextFor(workerId) {
      const row = workerId ? (workers.get(workerId) ?? null) : null
      return { row, changes: workerId ? (changesByWorker.get(workerId) ?? []) : [] }
    },
  }
}

export interface WorkerShiftRow extends ShiftForCost {
  worker_id: string
  deal_id?: string | null
}

/** Project cost (employer cost, no VAT) of the shifts, summed per deal. */
export function laborByDeal(
  shifts: readonly WorkerShiftRow[],
  book: WorkerCostBook,
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const shift of shifts) {
    if (!shift.deal_id) continue
    totals[shift.deal_id] =
      (totals[shift.deal_id] ?? 0) + contextShiftCost(shift, book.contextFor(shift.worker_id))
  }
  for (const dealId of Object.keys(totals)) totals[dealId] = roundMoney(totals[dealId])
  return totals
}
