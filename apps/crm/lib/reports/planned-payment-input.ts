/**
 * Validation of a planned (stage) payment from a request body. Pure.
 * Only amount, due_date and label are ever written; ids and company come from the route.
 */

export interface PlannedPaymentFields {
  amount: number
  /** YYYY-MM-DD; null = no due date (counted on the report's "no due date" line). */
  due_date: string | null
  label: string | null
}

export type PlannedPaymentErrorCode = 'amount_invalid' | 'due_date_invalid' | 'label_too_long'

export const MAX_PLANNED_AMOUNT = 1_000_000_000
const MAX_LABEL_LENGTH = 120

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export interface PlannedPaymentParseResult {
  /** Only the fields present in the body (all of them required on create). */
  fields: Partial<PlannedPaymentFields>
  errors: PlannedPaymentErrorCode[]
}

export function parsePlannedPayment(body: Record<string, unknown>, mode: 'create' | 'update'): PlannedPaymentParseResult {
  const fields: Partial<PlannedPaymentFields> = {}
  const errors: PlannedPaymentErrorCode[] = []

  if ('amount' in body || mode === 'create') {
    const raw = body.amount
    const amount = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
    if (Number.isFinite(amount) && amount > 0 && amount <= MAX_PLANNED_AMOUNT) {
      fields.amount = Math.round(amount * 100) / 100
    } else errors.push('amount_invalid')
  }

  if ('due_date' in body) {
    const raw = body.due_date
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) fields.due_date = null
    else if (typeof raw === 'string' && isRealDate(raw.trim())) fields.due_date = raw.trim()
    else errors.push('due_date_invalid')
  } else if (mode === 'create') fields.due_date = null

  if ('label' in body) {
    const raw = body.label
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) fields.label = null
    else if (typeof raw === 'string' && raw.trim().length <= MAX_LABEL_LENGTH) fields.label = raw.trim()
    else errors.push('label_too_long')
  } else if (mode === 'create') fields.label = null

  return { fields, errors }
}
