/**
 * The amount a cash-flow row had before an invoice replaced it.
 * Stored on the row itself (calc_meta.expenseMatch) so "unlink" can put it back
 * even after the invoice row is gone.
 */
export interface ExpenseMatchRecord {
  originalAmount: number
  invoiceId: string
}

export function withExpenseMatch(
  existing: unknown,
  originalAmount: number,
  invoiceId: string,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  const previous = readExpenseMatch(existing)
  return {
    ...base,
    expenseMatch: {
      originalAmount: previous?.originalAmount ?? originalAmount,
      invoiceId,
    } satisfies ExpenseMatchRecord,
  }
}

export function readExpenseMatch(calcMeta: unknown): ExpenseMatchRecord | null {
  if (!calcMeta || typeof calcMeta !== 'object') return null
  const match = (calcMeta as { expenseMatch?: unknown }).expenseMatch
  if (!match || typeof match !== 'object') return null
  const originalAmount = (match as { originalAmount?: unknown }).originalAmount
  const invoiceId = (match as { invoiceId?: unknown }).invoiceId
  if (typeof originalAmount !== 'number' || !Number.isFinite(originalAmount)) return null
  if (typeof invoiceId !== 'string' || !invoiceId) return null
  return { originalAmount, invoiceId }
}

/** Removes the match record. Returns null when nothing else was stored on the row. */
export function withoutExpenseMatch(calcMeta: unknown): Record<string, unknown> | null {
  if (!calcMeta || typeof calcMeta !== 'object' || Array.isArray(calcMeta)) return null
  const copy = { ...(calcMeta as Record<string, unknown>) }
  delete copy.expenseMatch
  return Object.keys(copy).length === 0 ? null : copy
}
