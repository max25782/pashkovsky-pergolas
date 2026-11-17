import { roundMoney } from '@/lib/finance/money'
import type { VatCalcMeta } from '@/lib/tazrim/calc-meta'
import type { CalculatedCashRow } from '@/lib/tazrim/vat-pension-rows'
import { VAT_SOURCE } from '@/lib/tazrim/vat-pension-rows'
import type { InvoiceDocType } from '@/lib/tazrim/expense-invoices/constants'
import { recognizedVatAmount } from '@/lib/tazrim/expense-invoices/validate'

export { supplierMonthVariance } from '@/lib/tazrim/expense-invoices/supplier-month'

export type InvoiceKind = 'preliminary' | 'tax_invoice'

export interface PeriodInvoiceInput {
  id?: string
  vatPeriod: string
  docType: InvoiceDocType
  docKind: InvoiceKind
  vendorId: string | null
  dealId: string | null
  netAmount: number | null
  vatAmount: number | null
  vatRecognizedPercent: number
  confirmed: boolean
  superseded: boolean
}

export interface DealMonthInput {
  dealId: string
  /** VAT inside the deal's material estimate, allocated to this source month. */
  materialsVat: number
}

export interface DealForecast {
  dealId: string
  /** Materials VAT still estimated after subtracting this deal's preliminary net. */
  estimatedVat: number
  /** Recognized VAT of preliminary documents that a monthly tax invoice has not replaced. */
  preliminaryVat: number
  /** True while this deal still contributes an estimate. Other deals are not affected. */
  estimated: boolean
}

export interface ForecastVat {
  vatOnSales: number
  inputVat: number
  vatPayable: number
  basis: 'estimate' | 'forecast' | 'invoices'
  estimated: boolean
  recognizedFromPreliminary: number
  recognizedFromTaxInvoices: number
  deals: DealForecast[]
}

export interface CloseVat {
  vatOnSales: number
  inputVat: number
  vatPayable: number
  /** Recognized VAT of preliminary documents, reported so a test can see it was left out. */
  preliminaryIgnored: number
}

function isVatMeta(meta: CalculatedCashRow['calc_meta']): meta is VatCalcMeta {
  return meta.kind === 'vat_payable' || meta.kind === 'vat_refund'
}

function active(invoice: PeriodInvoiceInput): boolean {
  return invoice.confirmed && !invoice.superseded
}

function credited(invoice: PeriodInvoiceInput): number {
  return recognizedVatAmount({
    docType: invoice.docType,
    vatAmount: invoice.vatAmount,
    vatRecognizedPercent: invoice.vatRecognizedPercent,
    confirmed: true,
  })
}

export function supplierMonthKey(vendorId: string, period: string): string {
  return `${vendorId}|${period}`
}

/** Confirmed tax invoices (not receipts) for this supplier and month replace that supplier's preliminary. */
export function taxInvoiceSupplierMonths(
  invoices: readonly PeriodInvoiceInput[],
  period: string,
): Set<string> {
  const keys = new Set<string>()
  for (const invoice of invoices) {
    if (!active(invoice) || invoice.vatPeriod !== period) continue
    if (invoice.docKind !== 'tax_invoice' || invoice.docType === 'receipt' || !invoice.vendorId) continue
    keys.add(supplierMonthKey(invoice.vendorId, period))
  }
  return keys
}

export function preliminaryIsSuperseded(invoice: PeriodInvoiceInput, taxKeys: ReadonlySet<string>): boolean {
  if (invoice.docKind !== 'preliminary' || !invoice.vendorId) return false
  return taxKeys.has(supplierMonthKey(invoice.vendorId, invoice.vatPeriod))
}

export function dealMaterialsVat(meta: VatCalcMeta): DealMonthInput[] {
  const byDeal = new Map<string, number>()
  for (const line of meta.lines) {
    byDeal.set(line.dealId, roundMoney((byDeal.get(line.dealId) ?? 0) + line.materialsVatDeduction))
  }
  return [...byDeal.entries()].map(([dealId, materialsVat]) => ({ dealId, materialsVat }))
}

/**
 * Open-period forecast.
 * A deal with no document keeps its materials VAT and stays marked estimated.
 * A preliminary document reduces that deal's materials net (not below zero) and
 * adds its own recognized VAT. A tax invoice for the same supplier and month
 * replaces those preliminary amounts: they are not added again. A tax invoice
 * of another month does not. Other deals are left as they were.
 */
export function computeForecastVat(input: {
  vatOnSales: number
  vatPercent: number
  deals: readonly DealMonthInput[]
  invoices: readonly PeriodInvoiceInput[]
  period: string
}): ForecastVat {
  const vatOnSales = roundMoney(input.vatOnSales)
  const rate = input.vatPercent > 0 ? input.vatPercent / 100 : 0
  const periodInvoices = input.invoices.filter((invoice) => invoice.vatPeriod === input.period)
  const taxKeys = taxInvoiceSupplierMonths(periodInvoices, input.period)
  const seen = new Set(input.deals.map((deal) => deal.dealId))

  const deals: DealForecast[] = input.deals.map((deal) => {
    const materialsVat = roundMoney(deal.materialsVat)
    const materialsNet = rate > 0 ? roundMoney(materialsVat / rate) : 0
    const prelims = periodInvoices.filter(
      (invoice) =>
        active(invoice) &&
        invoice.docKind === 'preliminary' &&
        invoice.dealId === deal.dealId &&
        invoice.docType !== 'receipt',
    )
    const coveredNet = roundMoney(prelims.reduce((sum, invoice) => sum + (invoice.netAmount ?? 0), 0))
    const preliminaryVat = roundMoney(
      prelims
        .filter((invoice) => !preliminaryIsSuperseded(invoice, taxKeys))
        .reduce((sum, invoice) => sum + credited(invoice), 0),
    )
    const estimatedVat =
      coveredNet > 0 && rate > 0
        ? roundMoney(Math.max(0, roundMoney(materialsNet - coveredNet)) * rate)
        : materialsVat
    return {
      dealId: deal.dealId,
      estimatedVat,
      preliminaryVat,
      estimated: estimatedVat > 0,
    }
  })

  const orphanPreliminary = roundMoney(
    periodInvoices
      .filter(
        (invoice) =>
          active(invoice) &&
          invoice.docKind === 'preliminary' &&
          invoice.docType !== 'receipt' &&
          invoice.dealId !== null &&
          !seen.has(invoice.dealId) &&
          !preliminaryIsSuperseded(invoice, taxKeys),
      )
      .reduce((sum, invoice) => sum + credited(invoice), 0),
  )

  const recognizedFromTaxInvoices = roundMoney(
    periodInvoices
      .filter((invoice) => active(invoice) && invoice.docKind === 'tax_invoice' && invoice.docType !== 'receipt')
      .reduce((sum, invoice) => sum + credited(invoice), 0),
  )
  const recognizedFromPreliminary = roundMoney(
    deals.reduce((sum, deal) => sum + deal.preliminaryVat, 0) + orphanPreliminary,
  )
  const estimatedInput = roundMoney(deals.reduce((sum, deal) => sum + deal.estimatedVat, 0))
  const inputVat = roundMoney(estimatedInput + recognizedFromPreliminary + recognizedFromTaxInvoices)
  const anyEstimate = deals.some((deal) => deal.estimated)
  const anyDocument = recognizedFromPreliminary > 0 || recognizedFromTaxInvoices > 0
  const basis: ForecastVat['basis'] = !anyDocument ? 'estimate' : anyEstimate ? 'forecast' : 'invoices'

  return {
    vatOnSales,
    inputVat,
    vatPayable: roundMoney(vatOnSales - inputVat),
    basis,
    estimated: basis !== 'invoices',
    recognizedFromPreliminary,
    recognizedFromTaxInvoices,
    deals,
  }
}

/**
 * Period close and the VAT report. Preliminary documents are forecast-only.
 * Input VAT is confirmed tax invoices times vat_recognized_percent / 100.
 * A deal or expense with no tax invoice contributes zero. Materials estimates
 * are not used.
 */
export function computeCloseVat(input: {
  vatOnSales: number
  invoices: readonly PeriodInvoiceInput[]
  period: string
}): CloseVat {
  const vatOnSales = roundMoney(input.vatOnSales)
  const periodInvoices = input.invoices.filter((invoice) => invoice.confirmed && invoice.vatPeriod === input.period)
  const preliminaryIgnored = roundMoney(
    periodInvoices
      .filter((invoice) => invoice.docKind === 'preliminary')
      .reduce((sum, invoice) => sum + credited(invoice), 0),
  )
  const inputVat = roundMoney(
    periodInvoices
      .filter((invoice) => invoice.docKind === 'tax_invoice' && invoice.docType !== 'receipt')
      .reduce((sum, invoice) => sum + credited(invoice), 0),
  )
  return {
    vatOnSales,
    inputVat,
    vatPayable: roundMoney(vatOnSales - inputVat),
    preliminaryIgnored,
  }
}

/** Monthly supplier invoice versus the preliminary documents it replaces. VAT uses the tax invoice. */
export function salesAndMaterialsVat(meta: VatCalcMeta): { vatOnSales: number; estimatedInputVat: number } {
  return {
    vatOnSales: roundMoney(meta.lines.reduce((sum, line) => sum + line.vatOnPayment, 0)),
    estimatedInputVat: roundMoney(meta.lines.reduce((sum, line) => sum + line.materialsVatDeduction, 0)),
  }
}

function rowFromPayable(
  row: CalculatedCashRow,
  meta: VatCalcMeta,
  payable: number,
  inputVat: number,
  basis: 'estimate' | 'forecast' | 'invoices',
  estimated: boolean,
): CalculatedCashRow {
  if (basis === 'estimate') {
    return {
      ...row,
      calc_meta: {
        ...meta,
        inputVatBasis: 'estimate',
        inputVatRecognized: inputVat,
        estimated: true,
      },
    }
  }
  const isRefund = payable < 0
  return {
    ...row,
    type: isRefund ? 'income' : 'expense',
    amount: Math.abs(payable),
    calc_meta: {
      ...meta,
      kind: isRefund ? 'vat_refund' : 'vat_payable',
      total: Math.abs(payable),
      inputVatBasis: basis,
      inputVatRecognized: inputVat,
      estimated,
    },
  }
}

/** Open period: forecast. Does not change the row when nothing but the materials estimate exists. */
export function applyPeriodVat(
  row: CalculatedCashRow,
  invoices: readonly PeriodInvoiceInput[],
): CalculatedCashRow {
  if (row.source !== VAT_SOURCE || !isVatMeta(row.calc_meta)) return row
  const meta = row.calc_meta
  const { vatOnSales } = salesAndMaterialsVat(meta)
  const forecast = computeForecastVat({
    vatOnSales,
    vatPercent: meta.vatPercent,
    deals: dealMaterialsVat(meta),
    invoices,
    period: meta.sourceMonth,
  })
  return rowFromPayable(row, meta, forecast.vatPayable, forecast.inputVat, forecast.basis, forecast.estimated)
}

/** Close: tax invoices only. Preliminary and the materials estimate drop out. */
export function applyCloseVat(
  row: CalculatedCashRow,
  invoices: readonly PeriodInvoiceInput[],
): CalculatedCashRow {
  if (row.source !== VAT_SOURCE || !isVatMeta(row.calc_meta)) return row
  const meta = row.calc_meta
  const { vatOnSales } = salesAndMaterialsVat(meta)
  const closed = computeCloseVat({ vatOnSales, invoices, period: meta.sourceMonth })
  return rowFromPayable(row, meta, closed.vatPayable, closed.inputVat, 'invoices', false)
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
