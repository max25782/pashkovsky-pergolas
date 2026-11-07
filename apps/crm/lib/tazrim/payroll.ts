import { createHash } from "node:crypto";

// Worker wages coming from AluminCRM (workers + worker_shifts). Pure helpers:
// no I/O, so the sync action stays thin and the rules live in one place.

// Wages for month M are paid on this day of month M+1 (Israeli practice).
export const PAYDAY_OF_MONTH = 10;

// cash_events.source values. "approved" rows were corrected by hand after the
// accountant's sign-off; the sync must never overwrite or delete them.
export const PAYROLL_SOURCE = "alumincrm_payroll";
export const PAYROLL_APPROVED_SOURCE = "alumincrm_payroll_approved";
export const PAYROLL_SOURCES = [PAYROLL_SOURCE, PAYROLL_APPROVED_SOURCE];

export const PAYROLL_CATEGORY = "שכר עבודה";

export interface CrmWorker {
  id: string;
  first_name: string | null;
  last_name: string | null;
  daily_rate: number | string | null;
  hourly_rate: number | string | null;
}

export interface CrmWorkerShift {
  worker_id: string;
  shift_date: string;
  shift_type: string | null;
  minutes_worked: number | null;
  computed_cost: number | string | null;
}

export interface WorkerMonthWage {
  workerId: string;
  workerName: string;
  // YYYY-MM of the shifts being paid for.
  month: string;
  amount: number;
  payDate: string;
}

// Same rules as AluminCRM (apps/crm/lib/workers/calculations.ts and the deal
// labor route): holiday = full day rate, day_off = 0, work = hourly rate * hours
// when an hourly rate exists, otherwise the full day rate. A work shift without
// minutes falls back to the stored computed_cost.
export function shiftCost(shift: CrmWorkerShift, worker: CrmWorker): number {
  const dailyRate = Number(worker.daily_rate ?? 0) || 0;
  const hourlyRate = Number(worker.hourly_rate ?? 0) || 0;
  const type = shift.shift_type ?? "work";

  if (type === "holiday") return dailyRate;
  if (type === "day_off") return 0;

  const minutes = shift.minutes_worked;
  if (minutes !== null && minutes >= 0) {
    return hourlyRate > 0 ? (hourlyRate * minutes) / 60 : dailyRate;
  }
  return Number(shift.computed_cost ?? 0) || 0;
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function previousMonth(isoDate: string): string {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;
}

// Payday of the month AFTER `month`, e.g. 2026-09 -> 2026-10-10.
export function paydayFor(month: string): string {
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
  return `${next}-${String(PAYDAY_OF_MONTH).padStart(2, "0")}`;
}

// Sums every worker's shifts per calendar month. Zero totals are dropped.
export function computeMonthlyWages(
  workers: CrmWorker[],
  shifts: CrmWorkerShift[]
): WorkerMonthWage[] {
  const byId = new Map(workers.map((w) => [w.id, w]));
  const totals = new Map<string, WorkerMonthWage>();

  for (const shift of shifts) {
    const worker = byId.get(shift.worker_id);
    if (!worker) continue;

    const month = monthOf(shift.shift_date);
    const key = `${worker.id}:${month}`;
    const entry = totals.get(key) ?? {
      workerId: worker.id,
      workerName:
        `${worker.first_name ?? ""} ${worker.last_name ?? ""}`.trim() || "עובד",
      month,
      amount: 0,
      payDate: paydayFor(month),
    };
    entry.amount += shiftCost(shift, worker);
    totals.set(key, entry);
  }

  return [...totals.values()]
    .map((w) => ({ ...w, amount: Math.round(w.amount * 100) / 100 }))
    .filter((w) => w.amount > 0);
}

// Stable id for a worker+month so repeated syncs upsert the same cash_event.
// Formatted as a UUID so it is valid whether external_id is text or uuid.
export function payrollExternalId(workerId: string, month: string): string {
  const hex = createHash("sha1")
    .update(`alumincrm-payroll:${workerId}:${month}`)
    .digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
