import { createHash } from 'node:crypto'
import { roundMoney } from '@/lib/finance/money'
import {
  allocateByPayments,
  computeDealFinance,
  monthOfDate,
  vatPayableByPaymentMonth,
} from '@/lib/deals/deal-finance'
import type { PensionReport } from '@/lib/workers/pension-report'
import {
  type CalcMeta,
  type PensionCalcLine,
  type VatCalcLine,
  type VatCalcMeta,
  type PensionCalcMeta,
} from '@/lib/tazrim/calc-meta'
import { dateInIsrael } from '@/lib/tazrim/format'

// Calculated cash events fed from AluminCRM: VAT payable to the tax authority
// and the employer's pension / pitzuim payment. Pure helpers: no I/O, so the
// sync action stays thin and the rules live in one place.
//
// notes holds locale-neutral JSON (CalcMeta). UI labels are built at display
// time from kind + sourceMonth + the user's language.

export const VAT_SOURCE = 'alumincrm_vat'
export const PENSION_SOURCE = 'alumincrm_pension'
export const CALCULATED_SOURCES = [VAT_SOURCE, PENSION_SOURCE]

export const VAT_PAYDAY_OF_MONTH = 15
export const PENSION_PAYDAY_OF_MONTH = 15

/** DB-ready row. `calc_meta` is the jsonb column; `notes` stays null for calc rows. */
export interface CalculatedCashRow {
  company_id: string
  type: 'income' | 'expense'
  amount: number
  currency: string
  due_date: string
  status: 'planned' | 'cleared'
  cleared_date: string | null
  source: string
  external_source: string
  external_id: string
  /** Always null for calculated rows — human text only. */
  notes: null
  /** Locale-neutral breakdown (tz_cash_events.calc_meta). */
  calc_meta: CalcMeta
}

function monthParts(month: string): { year: number; month: number } {
  return { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) }
}

export function nextMonth(month: string): string {
  const { year, month: m } = monthParts(month)
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`
}

function dayOf(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, '0')}`
}

function stableId(kind: string, companyId: string, month: string): string {
  const hex = createHash('sha1')
    .update(`alumincrm-${kind}:${companyId}:${month}`)
    .digest('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

export function vatExternalId(companyId: string, dueMonth: string): string {
  return stableId('vat', companyId, dueMonth)
}

export function pensionExternalId(companyId: string, dueMonth: string): string {
  return stableId('pension', companyId, dueMonth)
}

function statusFor(dueDate: string, today: string): Pick<CalculatedCashRow, 'status' | 'cleared_date'> {
  return dueDate <= today
    ? { status: 'cleared', cleared_date: dueDate }
    : { status: 'planned', cleared_date: null }
}

function paidDay(paidAt: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(paidAt) ? paidAt.slice(0, 10) : dateInIsrael(paidAt)
}

export interface VatDealInput {
  id: string
  customerName: string
  price: number | string | null
  my_cost: number | string | null
  labor?: number | string | null
  payments: ReadonlyArray<{ id: string; amount: number; paid_at: string }>
  fallbackDate: string
}

export interface BuildVatRowsInput {
  companyId: string
  today: string
  vatPercent: number
  deals: readonly VatDealInput[]
}

/**
 * Per-payment VAT lines for one deal, keyed by payment-month YYYY-MM.
 * Same allocation as vatPayableByPaymentMonth.
 */
export function buildVatDealLinesByMonth(
  deal: VatDealInput,
  vatPercent: number,
): Map<string, VatCalcLine[]> {
  const finance = computeDealFinance({
    price: deal.price,
    materials: deal.my_cost,
    labor: deal.labor ?? 0,
    vatPercent,
  })
  const byMonth = new Map<string, VatCalcLine[]>()
  if (finance.price <= 0) return byMonth

  const dated =
    deal.payments.length > 0
      ? deal.payments.map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paid_at }))
      : [{ id: deal.id, amount: finance.price, paidAt: deal.fallbackDate }]

  const perVat = allocateByPayments(finance.vatPayable, finance.price, dated)
  const perSale = allocateByPayments(finance.vatOnSale, finance.price, dated)
  const perMat = allocateByPayments(finance.vatOnMaterials, finance.price, dated)
  const noMaterials = finance.materials <= 0

  for (const p of dated) {
    const month = monthOfDate(p.paidAt)
    const line: VatCalcLine = {
      dealId: deal.id,
      dealName: deal.customerName || '—',
      paymentId: p.id,
      paymentAmount: p.amount,
      paidDate: paidDay(p.paidAt),
      vatOnPayment: perSale.get(p.id) ?? 0,
      materialsVatDeduction: perMat.get(p.id) ?? 0,
      vatPayable: perVat.get(p.id) ?? 0,
      noMaterials,
    }
    const bucket = byMonth.get(month) ?? []
    bucket.push(line)
    byMonth.set(month, bucket)
  }

  return byMonth
}

/**
 * One row per due month. Month M of received money is paid in M+1.
 * calc_meta = structured payload; notes left null.
 */
export function buildVatRows(input: BuildVatRowsInput): CalculatedCashRow[] {
  const currentMonth = input.today.slice(0, 7)
  const totalsByMonth = new Map<string, number>()
  const linesByMonth = new Map<string, VatCalcLine[]>()

  for (const deal of input.deals) {
    const finance = computeDealFinance({
      price: deal.price,
      materials: deal.my_cost,
      labor: deal.labor ?? 0,
      vatPercent: input.vatPercent,
    })
    if (finance.price <= 0) continue

    const dated =
      deal.payments.length > 0
        ? deal.payments.map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paid_at }))
        : [{ id: deal.id, amount: finance.price, paidAt: deal.fallbackDate }]

    const monthTotals = vatPayableByPaymentMonth(finance, dated)
    for (const [month, vat] of monthTotals) {
      totalsByMonth.set(month, roundMoney((totalsByMonth.get(month) ?? 0) + vat))
    }

    const dealLines = buildVatDealLinesByMonth(deal, input.vatPercent)
    for (const [month, lines] of dealLines) {
      if (!monthTotals.has(month)) continue
      const bucket = linesByMonth.get(month) ?? []
      bucket.push(...lines)
      linesByMonth.set(month, bucket)
    }
  }

  const rows: CalculatedCashRow[] = []
  for (const [paymentMonth, total] of totalsByMonth) {
    const dueMonth = nextMonth(paymentMonth)
    if (dueMonth < currentMonth || total === 0) continue

    const dueDate = dayOf(dueMonth, VAT_PAYDAY_OF_MONTH)
    const isRefund = total < 0
    const monthLines = linesByMonth.get(paymentMonth) ?? []
    const meta: VatCalcMeta = {
      v: 1,
      kind: isRefund ? 'vat_refund' : 'vat_payable',
      sourceMonth: paymentMonth,
      vatPercent: input.vatPercent,
      lines: monthLines,
      total: Math.abs(total),
    }
    rows.push({
      company_id: input.companyId,
      type: isRefund ? 'income' : 'expense',
      amount: Math.abs(total),
      currency: 'ILS',
      due_date: dueDate,
      ...statusFor(dueDate, input.today),
      source: VAT_SOURCE,
      external_source: 'alumincrm',
      external_id: vatExternalId(input.companyId, dueMonth),
      notes: null,
      calc_meta: meta,
    })
  }
  return rows.sort((a, b) => a.due_date.localeCompare(b.due_date))
}

export interface BuildPensionRowsInput {
  companyId: string
  today: string
  reports: readonly PensionReport[]
}

/** One expense row per worked month, paid in the following month. */
export function buildPensionRows(input: BuildPensionRowsInput): CalculatedCashRow[] {
  const rows: CalculatedCashRow[] = []
  for (const report of input.reports) {
    if (report.total <= 0) continue
    const dueMonth = nextMonth(report.month)
    const dueDate = dayOf(dueMonth, PENSION_PAYDAY_OF_MONTH)
    const lines: PensionCalcLine[] = report.rows.map((r) => ({
      workerId: r.workerId,
      workerName: r.workerName,
      days: r.days,
      gross: r.gross,
      pensionRate: r.pensionRate,
      pension: r.pension,
    }))
    const meta: PensionCalcMeta = {
      v: 1,
      kind: 'pension',
      sourceMonth: report.month,
      lines,
      total: report.total,
    }
    rows.push({
      company_id: input.companyId,
      type: 'expense',
      amount: report.total,
      currency: 'ILS',
      due_date: dueDate,
      ...statusFor(dueDate, input.today),
      source: PENSION_SOURCE,
      external_source: 'alumincrm',
      external_id: pensionExternalId(input.companyId, dueMonth),
      notes: null,
      calc_meta: meta,
    })
  }
  return rows.sort((a, b) => a.due_date.localeCompare(b.due_date))
}

/** Row shape ready for tz_cash_events upsert (notes null, calc_meta jsonb). */
export function toCashEventInsert(row: CalculatedCashRow): CalculatedCashRow {
  return row
}
