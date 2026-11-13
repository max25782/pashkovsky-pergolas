/** Postgres "undefined_table" and PostgREST "table not in schema cache": migration 065 is not applied. */
export function isMissingReportTable(error: { code?: string; message?: string }): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message ?? ''
  return /(planned_payments|weekly_report_)/.test(message) && /(does not exist|schema cache)/.test(message)
}
