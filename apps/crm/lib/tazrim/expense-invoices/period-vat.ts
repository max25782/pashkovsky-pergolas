import { roundMoney } from '@/lib/finance/money'
import type { VatCalcMeta } from '@/lib/tazrim/calc-meta'
import type { CalculatedCashRow } from '@/lib/tazrim/vat-pension-rows'
import { VAT_SOURCE } from '@/lib/tazrim/vat-pension-rows'
import type { InvoiceDocType } from '@/lib/tazrim/expense-invoices/constants'
import { recognizedVatAmount } from '@/lib/tazrim/expense-invoices/validate'

export interface PeriodInvoiceInput {
  vatPeriod: string
  docType: InvoiceDocType
  vatAmount: number | null
  vatRecognizedPercent: number
  confirmed: boolean
}

export interface PeriodVat {
  vatOnSales: number
  /** Deduction used for this period: invoices, or the old materials estimate. */
  inputVat: number
  vatPayable: number
  basis: 'estimate' | 'invoices'
  /** True when the deduction is still the materials estimate, not confirmed invoices. */
  estimated: boolean
  recognizedFromInvoices: number
}

/**
 * VAT to pay for one period.
 * With at least one confirmed tax invoice: sales VAT minus recognized invoice VAT
 * (vat × vat_recognized_percent / 100). Receipts add zero. The materials estimate
 * is not added on top, so a billed expense is not deducted twice.
 * With no confirmed tax invoice: the previous materials estimate, marked estimated.
 * Expenses that have no invoice are not given a separate credit; the reconciliation
 * screen lists them as "without invoice".
 */
export function computePeriodVat(input: {
  vatOnSales: number
  estimatedInputVat: number
  invoices: readonly PeriodInvoiceInput[]
}): PeriodVat {
  const vatOnSales = roundMoney(input.vatOnSales)
  const estimatedInputVat = roundMoney(input.estimatedInputVat)
  const creditable = input.invoices.filter(
    (invoice) => invoice.confirmed && invoice.docType !== 'receipt',
  )

  if (creditable.length === 0) {
    return {
      vatOnSales,
      inputVat: estimatedInputVat,
      vatPayable: roundMoney(vatOnSales - estimatedInputVat),
      basis: 'estimate',
      estimated: true,
      recognizedFromInvoices: 0,
    }
  }

  const recognized = roundMoney(
    creditable.reduce(
      (sum, invoice) =>
        sum +
        recognizedVatAmount({
          docType: invoice.docType,
          vatAmount: invoice.vatAmount,
          vatRecognizedPercent: invoice.vatRecognizedPercent,
          confirmed: true,
        }),
      0,
    ),
  )

  return {
    vatOnSales,
    inputVat: recognized,
    vatPayable: roundMoney(vatOnSales - recognized),
    basis: 'invoices',
    estimated: false,
    recognizedFromInvoices: recognized,
  }
}

export function salesAndMaterialsVat(meta: VatCalcMeta): { vatOnSales: number; estimatedInputVat: number } {
  return {
    vatOnSales: roundMoney(meta.lines.reduce((sum, line) => sum + line.vatOnPayment, 0)),
    estimatedInputVat: roundMoney(meta.lines.reduce((sum, line) => sum + line.materialsVatDeduction, 0)),
  }
}

function isVatMeta(meta: CalculatedCashRow['calc_meta']): meta is VatCalcMeta {
  return meta.kind === 'vat_payable' || meta.kind === 'vat_refund'
}

/**
 * Replaces a calculated VAT row when the period has confirmed tax invoices.
 * The estimate path keeps the amount buildVatRows already produced.
 */
export function applyPeriodVat(
  row: CalculatedCashRow,
  invoices: readonly PeriodInvoiceInput[],
): CalculatedCashRow {
  if (row.source !== VAT_SOURCE || !isVatMeta(row.calc_meta)) return row
  const meta = row.calc_meta
  const { vatOnSales, estimatedInputVat } = salesAndMaterialsVat(meta)
  const periodInvoices = invoices.filter((invoice) => invoice.vatPeriod === meta.sourceMonth)
  const period = computePeriodVat({ vatOnSales, estimatedInputVat, invoices: periodInvoices })

  if (period.basis === 'estimate') {
    return {
      ...row,
      calc_meta: {
        ...meta,
        inputVatBasis: 'estimate',
        inputVatRecognized: period.inputVat,
        estimated: true,
      },
    }
  }

  const isRefund = period.vatPayable < 0
  return {
    ...row,
    type: isRefund ? 'income' : 'expense',
    amount: Math.abs(period.vatPayable),
    calc_meta: {
      ...meta,
      kind: isRefund ? 'vat_refund' : 'vat_payable',
      total: Math.abs(period.vatPayable),
      inputVatBasis: 'invoices',
      inputVatRecognized: period.inputVat,
      estimated: false,
    },
  }
}

/** Closed periods stay as stored. Their external ids must survive the sync cleanup. */
export function withoutLockedPeriods(
  rows: readonly CalculatedCashRow[],
  closedSourceMonths: ReadonlySet<string>,
): { writable: CalculatedCashRow[]; lockedExternalIds: string[] } {
  const writable: CalculatedCashRow[] = []
  const lockedExternalIds: string[] = []
  for (const row of rows) {
    if (
      row.source === VAT_SOURCE &&
      isVatMeta(row.calc_meta) &&
      closedSourceMonths.has(row.calc_meta.sourceMonth)
    ) {
      lockedExternalIds.push(row.external_id)
      continue
    }
    writable.push(row)
  }
  return { writable, lockedExternalIds }
}
