/**
 * History of a worker's employer terms (coefficient, pension rate, "no pension").
 *
 * Costs are computed per day with the terms in force on that day (see
 * resolveTermsOn in employer-cost.ts), so a change in the middle of a month
 * does not rewrite the days before it. This module decides which history rows
 * to write when the worker card is saved.
 *
 * Pure: no React, no Supabase.
 */

import {
  DEFAULT_EMPLOYER_COEFFICIENT,
  DEFAULT_PENSION_RATE,
  type WorkerTermsRow,
} from '@/lib/workers/employer-cost'

export interface EmployerTermsValues {
  employerCoefficient: number
  pensionRate: number
  pensionExempt: boolean
}

export interface TermsHistoryInsert {
  effective_from: string
  employer_coefficient: number
  pension_rate: number
  pension_exempt: boolean
}

/** Before the first recorded change nothing older is known, so the baseline row reaches back to here. */
export const BASELINE_EFFECTIVE_FROM = '1970-01-01'

function numberOr(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : fallback
}

/** Terms stored on the worker row; defaults while the migration is not applied. */
export function currentTermsValues(row: WorkerTermsRow | null | undefined): EmployerTermsValues {
  return {
    employerCoefficient: numberOr(row?.employer_coefficient, DEFAULT_EMPLOYER_COEFFICIENT),
    pensionRate: numberOr(row?.pension_rate, DEFAULT_PENSION_RATE),
    pensionExempt: row?.pension_exempt === true,
  }
}

export function sameTerms(a: EmployerTermsValues, b: EmployerTermsValues): boolean {
  return (
    a.employerCoefficient === b.employerCoefficient &&
    a.pensionRate === b.pensionRate &&
    a.pensionExempt === b.pensionExempt
  )
}

export interface PlanTermsHistoryInput {
  before: EmployerTermsValues
  after: EmployerTermsValues
  /** True when the worker already has rows in worker_rate_history. */
  hasHistory: boolean
  /** YYYY-MM-DD, the day the new terms start. */
  today: string
}

/**
 * Rows to upsert (on worker_id + effective_from) for a save of the worker
 * card. No change: nothing. First change: a baseline row with the old values
 * so earlier days keep them, plus the new row. Later changes: the new row only.
 */
export function planTermsHistory(input: PlanTermsHistoryInput): TermsHistoryInsert[] {
  if (sameTerms(input.before, input.after)) return []

  const rows: TermsHistoryInsert[] = []
  if (!input.hasHistory) {
    rows.push({
      effective_from: BASELINE_EFFECTIVE_FROM,
      employer_coefficient: input.before.employerCoefficient,
      pension_rate: input.before.pensionRate,
      pension_exempt: input.before.pensionExempt,
    })
  }
  rows.push({
    effective_from: input.today,
    employer_coefficient: input.after.employerCoefficient,
    pension_rate: input.after.pensionRate,
    pension_exempt: input.after.pensionExempt,
  })
  return rows
}

export interface TermsInputErrors {
  employerCoefficient?: string
  pensionRate?: string
}

/** Validation shared by the API: coefficient 0-200 %, pension rate 0-100 %. */
export function validateTermsInput(input: Partial<EmployerTermsValues>): TermsInputErrors {
  const errors: TermsInputErrors = {}
  const { employerCoefficient, pensionRate } = input
  if (
    employerCoefficient !== undefined &&
    (!Number.isFinite(employerCoefficient) || employerCoefficient < 0 || employerCoefficient > 200)
  ) {
    errors.employerCoefficient = 'employerCoefficient must be a number from 0 to 200'
  }
  if (
    pensionRate !== undefined &&
    (!Number.isFinite(pensionRate) || pensionRate < 0 || pensionRate > 100)
  ) {
    errors.pensionRate = 'pensionRate must be a number from 0 to 100'
  }
  return errors
}
