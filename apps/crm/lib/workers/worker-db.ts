import type { Worker } from '@/types/workers'
import { currentTermsValues } from '@/lib/workers/terms-history'

/** DB row (snake_case) to the Worker the client gets, including the employer terms. */
export function workerFromDB(row: Record<string, unknown>): Worker {
  const terms = currentTermsValues(row)
  return {
    id: row.id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    phone: row.phone as string | null | undefined,
    role: row.role as string | null | undefined,
    dailyRate: parseFloat(String(row.daily_rate)),
    hourlyRate: row.hourly_rate != null ? parseFloat(String(row.hourly_rate)) : null,
    isActive: row.is_active as boolean,
    employerCoefficient: terms.employerCoefficient,
    pensionRate: terms.pensionRate,
    pensionExempt: terms.pensionExempt,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// PostgREST "column not in schema cache" and Postgres "undefined_column" / "undefined_table".
const SCHEMA_MISSING_CODES = new Set(['PGRST204', '42703', '42P01', 'PGRST205'])

export function isSchemaMissingError(error: { code?: string } | null | undefined): boolean {
  return Boolean(error?.code && SCHEMA_MISSING_CODES.has(error.code))
}

export const TERMS_MIGRATION_MESSAGE =
  'Employer coefficient and pension settings need migration 062_worker_employer_terms to be applied first.'
