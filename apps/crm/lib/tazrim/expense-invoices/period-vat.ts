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
  /** Vendor sends one monthly tax invoice. Preliminary rows of other vendors never enter A. */
  issuesMonthlyInvoice?: boolean
}

export interface DealMonthInput {
  dealId: string
  /** VAT inside the deal's material estimate, allocated to this source month. */
  materialsVat: number
}

export interface DealForecast {
  dealId: string
  /** This deal's materials estimate. It is part of E and is not reduced by invoices. */
  estimatedVat: number
  /** Always 0. Deal links are for cost, not for the VAT forecast. */
  preliminaryVat: number
  /** True while this deal still has a materials estimate. */
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

export function dealMaterialsVat(meta: VatCalcMeta): DealMonthInput[] {
  const byDeal = new Map<string, number>()
  for (const line of meta.lines) {
    byDeal.set(line.dealId, roundMoney((byDeal.get(line.dealId) ?? 0) + line.materialsVatDeduction))
  }
  return [...byDeal.entries()].map(([dealId, materialsVat]) => ({ dealId, materialsVat }))
}

/**
 * Actual input VAT for one month.
 * A monthly supplier (Panda) contributes its tax invoices when any exist,
 * otherwise its preliminary documents. Several tax invoices are summed.
 * A preliminary confirmed after that tax invoice is left out.
 * Every other supplier contributes only tax invoices. Their preliminary
 * documents never enter the total. Receipts and other types contribute nothing.
 */
export function actualInvoiceVat(
  invoices: readonly PeriodInvoiceInput[],
  period: string,
): { preliminary: number; tax: number; total: number } {
  const groups = new Map<string, PeriodInvoiceInput[]>()
  for (const invoice of invoices) {
    if (!active(invoice) || invoice.vatPeriod !== period || invoice.docType !== 'tax_invoice' || !invoice.vendorId) {
      continue
    }
    const key = supplierMonthKey(invoice.vendorId, period)
    const list = groups.get(key) ?? []
    list.push(invoice)
    groups.set(key, list)
  }
  let preliminary = 0
  let tax = 0
  for (const group of groups.values()) {
    const taxRows = group.filter((invoice) => invoice.docKind === 'tax_invoice')
    if (taxRows.length > 0) {
      tax += taxRows.reduce((sum, invoice) => sum + credited(invoice), 0)
      continue
    }
    preliminary += group
      .filter((invoice) => invoice.docKind === 'preliminary' && invoice.issuesMonthlyInvoice === true)
      .reduce((sum, invoice) => sum + credited(invoice), 0)
  }
  preliminary = roundMoney(preliminary)
  tax = roundMoney(tax)
  return { preliminary, tax, total: roundMoney(preliminary + tax) }
}

export interface PendingGeneralInvoice {
  vendorId: string
  name: string
  period: string
}

/** Monthly supplier with a confirmed preliminary and no tax invoice for this month. */
export function pendingGeneralInvoices(input: {
  period: string
  invoices: readonly PeriodInvoiceInput[]
  vendors: readonly { id: string; name: string; issuesMonthlyInvoice: boolean }[]
}): PendingGeneralInvoice[] {
  return input.vendors
    .filter((vendor) => vendor.issuesMonthlyInvoice)
    .flatMap((vendor) => {
      const rows = input.invoices.filter(
        (invoice) =>
          invoice.confirmed &&
          invoice.vatPeriod === input.period &&
          invoice.vendorId === vendor.id &&
          invoice.docType === 'tax_invoice',
      )
      const hasTax = rows.some((invoice) => invoice.docKind === 'tax_invoice')
      const hasPreliminary = rows.some((invoice) => invoice.docKind === 'preliminary')
      return hasPreliminary && !hasTax ? [{ vendorId: vendor.id, name: vendor.name, period: input.period }] : []
    })
}

/**
 * Open-period materials forecast for the whole month: max(E, A).
 * E is the sum of deal material estimates. A is actualInvoiceVat.
 * Invoices are not added on top of the estimate, and one invoice does not
 * reduce another deal. A tax invoice from another month is not in A.
 */
export function computeForecastVat(input: {
  vatOnSales: number
  vatPercent: number
  deals: readonly DealMonthInput[]
  invoices: readonly PeriodInvoiceInput[]
  period: string
}): ForecastVat {
  const vatOnSales = roundMoney(input.vatOnSales)
  const estimatedInput = roundMoney(input.deals.reduce((sum, deal) => sum + deal.materialsVat, 0))
  const actual = actualInvoiceVat(input.invoices, input.period)
  const inputVat = roundMoney(Math.max(estimatedInput, actual.total))
  const basis: ForecastVat['basis'] =
    actual.total === 0 ? 'estimate' : actual.total < estimatedInput ? 'forecast' : 'invoices'
  const deals: DealForecast[] = input.deals.map((deal) => {
    const estimatedVat = roundMoney(deal.materialsVat)
    return { dealId: deal.dealId, estimatedVat, preliminaryVat: 0, estimated: estimatedVat > 0 }
  })

  return {
    vatOnSales,
    inputVat,
    vatPayable: roundMoney(vatOnSales - inputVat),
    basis,
    estimated: basis !== 'invoices',
    recognizedFromPreliminary: actual.preliminary,
    recognizedFromTaxInvoices: actual.tax,
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
      .filter((invoice) => invoice.docKind === 'tax_invoice' && invoice.docType === 'tax_invoice')
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
