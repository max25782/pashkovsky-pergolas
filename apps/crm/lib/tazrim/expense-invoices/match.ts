import { roundMoney } from '@/lib/finance/money'
import { addDays } from '@/lib/tazrim/format'
import {
  MATCH_AMOUNT_ABS_ILS,
  MATCH_AMOUNT_RATIO,
  MATCH_DATE_WINDOW_DAYS,
} from '@/lib/tazrim/expense-invoices/constants'
import { normalizeSupplierName } from '@/lib/tazrim/expense-invoices/validate'

const NOT_PRELIMINARY = new Set([
  'alumincrm_vat',
  'alumincrm_pension',
  'alumincrm_payroll',
  'alumincrm_payroll_approved',
])

export function isPreliminaryExpense(source: string): boolean {
  return !NOT_PRELIMINARY.has(source)
}

export function amountTolerance(estimate: number): number {
  return Math.max(MATCH_AMOUNT_ABS_ILS, roundMoney(Math.abs(estimate) * MATCH_AMOUNT_RATIO))
}

export function amountWithinTolerance(actual: number, estimate: number): boolean {
  return Math.abs(roundMoney(actual) - roundMoney(estimate)) <= amountTolerance(estimate) + 1e-9
}

export function daysApart(a: string, b: string): number {
  const left = Date.parse(`${a.slice(0, 10)}T00:00:00Z`)
  const right = Date.parse(`${b.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.POSITIVE_INFINITY
  return Math.abs(left - right) / 86_400_000
}

export function dateWithinWindow(invoiceDate: string, dueDate: string): boolean {
  return daysApart(invoiceDate, dueDate) <= MATCH_DATE_WINDOW_DAYS
}

export interface MatchExpense {
  id: string
  companyId: string
  vendorId: string | null
  vendorName: string | null
  amount: number
  dueDate: string
  source: string
}

export interface MatchInvoice {
  id: string
  companyId: string
  vendorId: string | null
  supplierName: string
  totalAmount: number
  invoiceDate: string
}

export function vendorsMatch(
  invoice: Pick<MatchInvoice, 'vendorId' | 'supplierName'>,
  expense: Pick<MatchExpense, 'vendorId' | 'vendorName'>,
): boolean {
  if (invoice.vendorId && expense.vendorId) return invoice.vendorId === expense.vendorId
  const left = normalizeSupplierName(invoice.supplierName)
  const right = normalizeSupplierName(expense.vendorName ?? '')
  return left.length > 0 && left === right
}

export function expenseCompatible(invoice: MatchInvoice, expense: MatchExpense): boolean {
  if (invoice.companyId !== expense.companyId) return false
  if (!isPreliminaryExpense(expense.source)) return false
  if (!vendorsMatch(invoice, expense)) return false
  if (!amountWithinTolerance(invoice.totalAmount, expense.amount)) return false
  if (!dateWithinWindow(invoice.invoiceDate, expense.dueDate)) return false
  return true
}

export type InvoiceMatch =
  | {
      invoiceId: string
      status: 'matched'
      expenseId: string
      estimatedAmount: number
      varianceAmount: number
    }
  | { invoiceId: string; status: 'none' }
  | { invoiceId: string; status: 'duplicate'; expenseIds: string[] }

interface Scored {
  expense: MatchExpense
  amountDiff: number
  dateDiff: number
}

function score(invoice: MatchInvoice, expense: MatchExpense): Scored {
  return {
    expense,
    amountDiff: Math.abs(roundMoney(invoice.totalAmount) - roundMoney(expense.amount)),
    dateDiff: daysApart(invoice.invoiceDate, expense.dueDate),
  }
}

function tiedBest(invoice: MatchInvoice, expenses: readonly MatchExpense[]): MatchExpense[] {
  const scored = expenses
    .filter((expense) => expenseCompatible(invoice, expense))
    .map((expense) => score(invoice, expense))
    .sort((a, b) => a.amountDiff - b.amountDiff || a.dateDiff - b.dateDiff || a.expense.id.localeCompare(b.expense.id))
  if (scored.length === 0) return []
  const best = scored[0]
  return scored
    .filter((row) => row.amountDiff === best.amountDiff && row.dateDiff === best.dateDiff)
    .map((row) => row.expense)
}

/**
 * One confirmed invoice against the month's preliminary expenses.
 * A tie (two expenses equally close) is a duplicate: nothing is auto-assigned.
 * Expenses of another company never match.
 */
export function matchInvoice(
  invoice: MatchInvoice,
  expenses: readonly MatchExpense[],
): InvoiceMatch {
  const best = tiedBest(invoice, expenses)
  if (best.length === 0) return { invoiceId: invoice.id, status: 'none' }
  if (best.length > 1) {
    return { invoiceId: invoice.id, status: 'duplicate', expenseIds: best.map((row) => row.id) }
  }
  const expense = best[0]
  return {
    invoiceId: invoice.id,
    status: 'matched',
    expenseId: expense.id,
    estimatedAmount: roundMoney(expense.amount),
    varianceAmount: roundMoney(invoice.totalAmount - expense.amount),
  }
}

export interface Reconciliation {
  matches: InvoiceMatch[]
  expensesWithoutInvoice: MatchExpense[]
}

/**
 * Assigns each invoice at most one expense and each expense at most one invoice.
 * When two invoices want the same expense, the closer pair wins and the other
 * invoice is reported as a duplicate so the user picks.
 */
export function reconcileInvoices(
  invoices: readonly MatchInvoice[],
  expenses: readonly MatchExpense[],
): Reconciliation {
  const preliminary = expenses.filter((expense) => isPreliminaryExpense(expense.source))
  const singles: Array<{ invoice: MatchInvoice; expense: MatchExpense; amountDiff: number; dateDiff: number }> = []
  const results = new Map<string, InvoiceMatch>()

  for (const invoice of invoices) {
    const best = tiedBest(invoice, preliminary)
    if (best.length === 0) {
      results.set(invoice.id, { invoiceId: invoice.id, status: 'none' })
      continue
    }
    if (best.length > 1) {
      results.set(invoice.id, {
        invoiceId: invoice.id,
        status: 'duplicate',
        expenseIds: best.map((row) => row.id),
      })
      continue
    }
    const scored = score(invoice, best[0])
    singles.push({ invoice, expense: best[0], amountDiff: scored.amountDiff, dateDiff: scored.dateDiff })
  }

  singles.sort(
    (a, b) => a.amountDiff - b.amountDiff || a.dateDiff - b.dateDiff || a.invoice.id.localeCompare(b.invoice.id),
  )

  const usedExpenses = new Set<string>()
  for (const pair of singles) {
    if (usedExpenses.has(pair.expense.id)) {
      results.set(pair.invoice.id, {
        invoiceId: pair.invoice.id,
        status: 'duplicate',
        expenseIds: [pair.expense.id],
      })
      continue
    }
    usedExpenses.add(pair.expense.id)
    results.set(pair.invoice.id, {
      invoiceId: pair.invoice.id,
      status: 'matched',
      expenseId: pair.expense.id,
      estimatedAmount: roundMoney(pair.expense.amount),
      varianceAmount: roundMoney(pair.invoice.totalAmount - pair.expense.amount),
    })
  }

  const matches = invoices.map((invoice) => results.get(invoice.id) ?? { invoiceId: invoice.id, status: 'none' as const })
  const expensesWithoutInvoice = preliminary.filter((expense) => !usedExpenses.has(expense.id))
  return { matches, expensesWithoutInvoice }
}

export function monthBounds(period: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(period)) return null
  const start = `${period}-01`
  const [year, month] = period.split('-').map(Number)
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return {
    from: addDays(start, -MATCH_DATE_WINDOW_DAYS),
    to: addDays(end, MATCH_DATE_WINDOW_DAYS),
  }
}
