import { roundMoney } from '@/lib/finance/money'
import {
  DOC_TYPES,
  VAT_AGOROT_TOLERANCE,
  type InvoiceDocType,
} from '@/lib/tazrim/expense-invoices/constants'

export interface InvoiceDraft {
  supplierName: string
  supplierTaxId: string
  invoiceNumber: string
  invoiceDate: string
  docType: InvoiceDocType
  currency: string
  netAmount: number | null
  vatRate: number | null
  vatAmount: number | null
  totalAmount: number | null
  allocationNumber: string | null
  vatRecognizedPercent: number
  categoryId: string | null
  vendorId: string | null
  /** Omitted on an extraction draft. Set before confirm. */
  docKind?: 'preliminary' | 'tax_invoice'
  dealId?: string | null
  isMonthly?: boolean
}

export interface ConfirmedInvoiceKey {
  id?: string
  supplierTaxId: string
  invoiceNumber: string
}

export type InvoiceIssueCode =
  | 'vat_mismatch'
  | 'total_mismatch'
  | 'duplicate_invoice'
  | 'receipt_not_creditable'
  | 'missing_supplier'
  | 'missing_tax_id'
  | 'missing_number'
  | 'missing_date'
  | 'missing_amounts'
  | 'bad_percent'
  | 'allocation_missing'
  | 'missing_deal'
  | 'missing_vendor'
  | 'kind_not_tax_invoice'

export interface ValidationIssue {
  code: InvoiceIssueCode
  blocking: boolean
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** ח.פ. / ע.מ. — compare digits only so "51-234567-8" matches "512345678". */
export function normalizeSupplierTaxId(value: string | null | undefined): string {
  return digitsOnly(value ?? '')
}

export function normalizeInvoiceNumber(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, '').toUpperCase()
}

export function normalizeSupplierName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/["'״׳.`]/g, '')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function vatPeriodFromDate(isoDate: string | null | undefined): string {
  if (!isoDate) return ''
  const day = isoDate.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day.slice(0, 7) : ''
}

export function isInvoiceDocType(value: string): value is InvoiceDocType {
  return (DOC_TYPES as readonly string[]).includes(value)
}

export function amountsClose(a: number, b: number, tolerance = VAT_AGOROT_TOLERANCE): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) <= tolerance + 1e-9
}

/**
 * VAT that actually reduces the period's payment.
 * Receipts are never creditable. Unconfirmed rows contribute nothing.
 * Percent is the accountant's share (category default or a manual override).
 */
export function recognizedVatAmount(input: {
  docType: InvoiceDocType
  vatAmount: number | null
  vatRecognizedPercent: number
  confirmed: boolean
}): number {
  if (!input.confirmed || input.docType !== 'tax_invoice') return 0
  const vat = input.vatAmount ?? 0
  if (!Number.isFinite(vat) || vat === 0) return 0
  const percent = Number.isFinite(input.vatRecognizedPercent) ? input.vatRecognizedPercent : 0
  return roundMoney(vat * (percent / 100))
}

export function isDuplicateConfirmed(
  draft: Pick<InvoiceDraft, 'supplierTaxId' | 'invoiceNumber'>,
  existing: readonly ConfirmedInvoiceKey[],
  selfId?: string,
): boolean {
  const taxId = normalizeSupplierTaxId(draft.supplierTaxId)
  const number = normalizeInvoiceNumber(draft.invoiceNumber)
  if (!taxId || !number) return false
  return existing.some(
    (row) =>
      row.id !== selfId &&
      normalizeSupplierTaxId(row.supplierTaxId) === taxId &&
      normalizeInvoiceNumber(row.invoiceNumber) === number,
  )
}

export function validateInvoiceDraft(
  draft: InvoiceDraft,
  options: {
    existingConfirmed: readonly ConfirmedInvoiceKey[]
    selfId?: string
    mode: 'review' | 'confirm'
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const confirm = options.mode === 'confirm'

  if (confirm && !draft.supplierName.trim()) {
    issues.push({ code: 'missing_supplier', blocking: true })
  }
  if (confirm && !normalizeSupplierTaxId(draft.supplierTaxId)) {
    issues.push({ code: 'missing_tax_id', blocking: true })
  }
  if (confirm && !normalizeInvoiceNumber(draft.invoiceNumber)) {
    issues.push({ code: 'missing_number', blocking: true })
  }
  if (confirm && !vatPeriodFromDate(draft.invoiceDate)) {
    issues.push({ code: 'missing_date', blocking: true })
  }
  if (
    !Number.isFinite(draft.vatRecognizedPercent) ||
    draft.vatRecognizedPercent < 0 ||
    draft.vatRecognizedPercent > 100
  ) {
    issues.push({ code: 'bad_percent', blocking: true })
  }

  const net = draft.netAmount
  const vat = draft.vatAmount
  const total = draft.totalAmount
  const rate = draft.vatRate

  if (confirm && (net === null || vat === null || total === null)) {
    issues.push({ code: 'missing_amounts', blocking: true })
  }

  if (net !== null && vat !== null && rate !== null && draft.docType !== 'receipt') {
    const expectedVat = roundMoney(net * (rate / 100))
    if (!amountsClose(expectedVat, vat)) {
      issues.push({ code: 'vat_mismatch', blocking: true })
    }
  }

  if (net !== null && vat !== null && total !== null && !amountsClose(roundMoney(net + vat), total)) {
    issues.push({ code: 'total_mismatch', blocking: true })
  }

  if (
    isDuplicateConfirmed(
      draft,
      options.existingConfirmed,
      options.selfId,
    )
  ) {
    issues.push({ code: 'duplicate_invoice', blocking: true })
  }

  if (draft.docType === 'receipt') {
    issues.push({ code: 'receipt_not_creditable', blocking: false })
  }

  if (draft.docType === 'tax_invoice' && !draft.allocationNumber?.trim()) {
    issues.push({ code: 'allocation_missing', blocking: false })
  }

  if (confirm && draft.docKind === 'preliminary' && !draft.dealId) {
    issues.push({ code: 'missing_deal', blocking: true })
  }
  if (confirm && (draft.docKind === 'preliminary' || draft.docKind === 'tax_invoice') && !draft.vendorId) {
    issues.push({ code: 'missing_vendor', blocking: true })
  }
  if (draft.docKind === 'tax_invoice' && draft.docType !== 'tax_invoice') {
    issues.push({ code: 'kind_not_tax_invoice', blocking: true })
  }

  return issues
}
