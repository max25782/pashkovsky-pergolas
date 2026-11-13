/**
 * What a worker really costs the employer, and the pension owed on it.
 *
 * Money model (worker_shifts / timesheet):
 *   net day rate      what the timesheet and the PDF show (e.g. 500)
 *   employer cost     net x (1 + coefficient / 100)   default coefficient 25 -> 625
 *                     This is the project cost AND the gross pension is charged on.
 *   pension + pitzuim employer gross x pension rate / 100, default 12.5
 *
 * The 25% coefficient already contains pension and pitzuim, so the project
 * cost is NOT reduced by pension a second time: pension only feeds Tazrim
 * cash flow (lib/tazrim/vat-pension-rows.ts). No VAT on workers.
 *
 * Pure: no React, no Supabase. Used by the labor API, statistics, the kanban
 * card, the pension screen and the Tazrim sync, so every place agrees.
 */

import { roundMoney, toAmount } from '@/lib/finance/money'
import { computeShiftCost } from '@/lib/workers/calculations'

export const DEFAULT_EMPLOYER_COEFFICIENT = 25
export const DEFAULT_PENSION_RATE = 12.5

/** A worker row as stored (snake_case); the new columns may be absent before the migration. */
export interface WorkerTermsRow {
  daily_rate?: number | string | null
  hourly_rate?: number | string | null
  employer_coefficient?: number | string | null
  pension_rate?: number | string | null
  pension_exempt?: boolean | null
}

export interface WorkerTerms {
  dailyRate: number
  hourlyRate: number | null
  /** Percent added on top of the net rate. */
  employerCoefficient: number
  /** Percent of the employer gross paid to the pension and pitzuim funds. */
  pensionRate: number
  /** Self-employed and similar: no pension row is created. */
  pensionExempt: boolean
}

/**
 * One change of terms, effective from a date. A null field keeps the
 * worker's current value, so a row that only moves the coefficient does not
 * touch the day rate.
 */
export interface WorkerTermsChange {
  effective_from: string
  daily_rate?: number | string | null
  hourly_rate?: number | string | null
  employer_coefficient?: number | string | null
  pension_rate?: number | string | null
  pension_exempt?: boolean | null
}

export interface ShiftForCost {
  shift_type?: string | null
  minutes_worked?: number | null
  computed_cost?: number | string | null
  shift_date?: string | null
}

function optionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Terms of a worker today. `row` null means the worker no longer exists: the
 * defaults apply (25% coefficient, default pension rate).
 */
export function workerTermsFromRow(row: WorkerTermsRow | null | undefined): WorkerTerms {
  const hourly = optionalNumber(row?.hourly_rate)
  return {
    dailyRate: toAmount(row?.daily_rate),
    hourlyRate: hourly !== null && hourly > 0 ? hourly : null,
    employerCoefficient:
      optionalNumber(row?.employer_coefficient) ?? DEFAULT_EMPLOYER_COEFFICIENT,
    pensionRate: optionalNumber(row?.pension_rate) ?? DEFAULT_PENSION_RATE,
    pensionExempt: row?.pension_exempt === true,
  }
}

/**
 * The terms in force on `date`: the latest change effective on or before it
 * over the current terms; a date before the first change uses that first
 * change (nothing older is known). No changes: the current terms.
 */
export function resolveTermsOn(
  date: string,
  current: WorkerTerms,
  changes: readonly WorkerTermsChange[],
): WorkerTerms {
  if (changes.length === 0) return current

  const sorted = [...changes].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  const applicable = sorted.filter((c) => c.effective_from <= date)
  // Before the first recorded change, use the earliest one.
  const chosen = applicable.length > 0 ? applicable[applicable.length - 1] : sorted[0]

  const daily = optionalNumber(chosen.daily_rate)
  const hourly = optionalNumber(chosen.hourly_rate)
  const coefficient = optionalNumber(chosen.employer_coefficient)
  const pension = optionalNumber(chosen.pension_rate)

  return {
    dailyRate: daily ?? current.dailyRate,
    hourlyRate: hourly !== null ? (hourly > 0 ? hourly : null) : current.hourlyRate,
    employerCoefficient: coefficient ?? current.employerCoefficient,
    pensionRate: pension ?? current.pensionRate,
    pensionExempt: chosen.pension_exempt ?? current.pensionExempt,
  }
}

/**
 * Net cost of one shift (what the worker is paid). Same rules as the
 * timesheet: holiday = full day rate, day off = 0, work = hourly rate x hours
 * when an hourly rate exists, otherwise the full day rate; a work shift with
 * no minutes falls back to the stored computed_cost.
 */
export function shiftNetCost(shift: ShiftForCost, terms: WorkerTerms): number {
  const type = shift.shift_type ?? 'work'
  if (type === 'holiday') return terms.dailyRate
  if (type === 'day_off') return 0
  const minutes = shift.minutes_worked
  if (minutes !== null && minutes !== undefined && minutes >= 0) {
    return computeShiftCost(minutes, terms.dailyRate, terms.hourlyRate)
  }
  return toAmount(shift.computed_cost)
}

/** net x (1 + coefficient / 100), rounded to agorot: 500 at 25% -> 625. */
export function employerCost(netAmount: number, employerCoefficient: number): number {
  return roundMoney(netAmount * (1 + employerCoefficient / 100))
}

/** What one shift costs the project (employer cost, no VAT). */
export function shiftProjectCost(shift: ShiftForCost, terms: WorkerTerms): number {
  return employerCost(shiftNetCost(shift, terms), terms.employerCoefficient)
}

export interface WorkerCostContext {
  /** null for a worker that no longer exists. */
  row: WorkerTermsRow | null
  changes: readonly WorkerTermsChange[]
}

/** Terms for one shift, honouring changes made during the month. */
export function termsForShift(shift: ShiftForCost, context: WorkerCostContext): WorkerTerms {
  const current = workerTermsFromRow(context.row)
  const date = shift.shift_date ?? ''
  return date === '' ? current : resolveTermsOn(date, current, context.changes)
}

/**
 * Project cost of one shift of a worker described by `context`. A worker that
 * no longer exists has no rate to recompute from, so the cost stored on the
 * shift is used, with the default coefficient.
 */
export function contextShiftCost(shift: ShiftForCost, context: WorkerCostContext): number {
  const terms = termsForShift(shift, context)
  const net = context.row === null ? toAmount(shift.computed_cost) : shiftNetCost(shift, terms)
  return employerCost(net, terms.employerCoefficient)
}

export function sumProjectCost(
  shifts: readonly ShiftForCost[],
  context: WorkerCostContext,
): number {
  return roundMoney(shifts.reduce((sum, shift) => sum + contextShiftCost(shift, context), 0))
}

export interface WorkerMonthPension {
  /** Employer gross for the month (sum of shift employer costs). */
  gross: number
  /** gross x pension rate, per day with that day's terms, rounded once. */
  pension: number
  days: number
  /** True when the worker is flagged without pension for every counted day. */
  exempt: boolean
}

/**
 * Pension and pitzuim of one worker for the shifts of one month. Each shift
 * is priced with the terms of its own date, so a rate or coefficient changed
 * mid-month is split by day. Exempt days add to gross but not to pension.
 * 21 days x 625 = 13 125 gross -> 1 640.63.
 */
export function computeWorkerMonthPension(
  shifts: readonly ShiftForCost[],
  context: WorkerCostContext,
): WorkerMonthPension {
  let gross = 0
  let pension = 0
  let days = 0
  let exemptDays = 0

  for (const shift of shifts) {
    const terms = termsForShift(shift, context)
    const dayGross = contextShiftCost(shift, context)
    if (dayGross <= 0) continue
    days += 1
    gross += dayGross
    if (terms.pensionExempt) {
      exemptDays += 1
      continue
    }
    pension += (dayGross * terms.pensionRate) / 100
  }

  return {
    gross: roundMoney(gross),
    pension: roundMoney(pension),
    days,
    exempt: days > 0 && exemptDays === days,
  }
}
