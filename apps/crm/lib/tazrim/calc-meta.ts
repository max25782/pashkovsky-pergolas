/**
 * Locale-neutral payload for calculated Tazrim rows (VAT / pension).
 * Preferred storage: tz_cash_events.calc_meta (jsonb).
 * Legacy: JSON string in tz_cash_events.notes (migrated by 066).
 * Labels are built at display time — never show raw JSON to the user.
 */

export const CALC_META_VERSION = 1 as const

export type CalcKind = 'vat_payable' | 'vat_refund' | 'pension'

export interface VatCalcLine {
  dealId: string
  dealName: string
  paymentId: string
  paymentAmount: number
  /** YYYY-MM-DD (Israel calendar day of the payment). */
  paidDate: string
  vatOnPayment: number
  materialsVatDeduction: number
  vatPayable: number
  noMaterials: boolean
}

export interface PensionCalcLine {
  workerId: string
  workerName: string
  days: number
  gross: number
  pensionRate: number
  pension: number
}

export interface VatCalcMeta {
  v: typeof CALC_META_VERSION
  kind: 'vat_payable' | 'vat_refund'
  /** Worked / payment month YYYY-MM (not the due month). */
  sourceMonth: string
  vatPercent: number
  lines: VatCalcLine[]
  total: number
  /**
   * 'estimate' — every deal still uses the materials figure.
   * 'forecast' — open month: preliminary documents per deal, plus estimates for the rest.
   * 'invoices' — period close, or a forecast with no materials estimate left.
   *              Only confirmed tax invoices count; preliminary documents do not.
   */
  inputVatBasis?: 'estimate' | 'forecast' | 'invoices'
  /** Deduction used for the period. */
  inputVatRecognized?: number
  /** True while any deal in the month still uses a materials estimate. */
  estimated?: boolean
}

export interface PensionCalcMeta {
  v: typeof CALC_META_VERSION
  kind: 'pension'
  sourceMonth: string
  lines: PensionCalcLine[]
  total: number
}

export type CalcMeta = VatCalcMeta | PensionCalcMeta

export function isCalcMeta(value: unknown): value is CalcMeta {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  if (o.v !== CALC_META_VERSION) return false
  if (o.kind !== 'vat_payable' && o.kind !== 'vat_refund' && o.kind !== 'pension') return false
  if (typeof o.sourceMonth !== 'string' || !/^\d{4}-\d{2}$/.test(o.sourceMonth)) return false
  if (!Array.isArray(o.lines) || typeof o.total !== 'number') return false
  return true
}

/** True when notes looks like CalcMeta JSON (even if validation fails). */
export function looksLikeCalcMetaJson(notes: string | null | undefined): boolean {
  if (!notes) return false
  const trimmed = notes.trim()
  if (!trimmed.startsWith('{')) return false
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object') return false
    const o = parsed as Record<string, unknown>
    return o.kind === 'vat_payable' || o.kind === 'vat_refund' || o.kind === 'pension'
  } catch {
    return false
  }
}

/** Encode for debugging / tests. Prefer writing the object to calc_meta. */
export function serializeCalcMeta(meta: CalcMeta): string {
  return JSON.stringify(meta)
}

/** Parse a notes string written by serializeCalcMeta. Legacy Russian prose → null. */
export function parseCalcMeta(notes: string | null | undefined): CalcMeta | null {
  if (!notes) return null
  const trimmed = notes.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    return isCalcMeta(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Resolve meta from the jsonb column first, then legacy notes JSON. */
export function resolveCalcMeta(input: {
  calc_meta?: unknown
  notes?: string | null
}): CalcMeta | null {
  if (isCalcMeta(input.calc_meta)) return input.calc_meta
  return parseCalcMeta(input.notes)
}

/**
 * Human notes for tables/forms. Hides CalcMeta JSON entirely.
 * Manual expenses and payroll labels pass through unchanged.
 */
export function displayCashNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  if (looksLikeCalcMetaJson(notes)) return null
  return notes
}

/** MM/YYYY for display next to the kind label. */
export function formatSourceMonth(sourceMonth: string): string {
  return `${sourceMonth.slice(5, 7)}/${sourceMonth.slice(0, 4)}`
}

/** Hebrew fallback title when next-intl is not available (server prose). */
export function calcMetaTitleHe(meta: CalcMeta): string {
  const kind =
    meta.kind === 'vat_payable'
      ? 'מע״מ לתשלום'
      : meta.kind === 'vat_refund'
        ? 'החזר מע״מ'
        : 'פנסיה ופיצויים'
  return `${kind} · ${formatSourceMonth(meta.sourceMonth)}`
}

export type CalcLabelKey =
  | 'vat_payable'
  | 'vat_refund'
  | 'pension'
  | 'calculated'
  | 'replaced_by_manual'
  | 'no_materials'
  | 'total'
  | 'col_deal'
  | 'col_payment'
  | 'col_date'
  | 'col_vat_on_payment'
  | 'col_materials_deduction'
  | 'col_vat_payable'
  | 'col_worker'
  | 'col_days'
  | 'col_gross'
  | 'col_rate'
  | 'col_pension'
  | 'expand'
  | 'collapse'

export function calcKindLabelKey(kind: CalcKind): Extract<CalcLabelKey, 'vat_payable' | 'vat_refund' | 'pension'> {
  return kind
}
