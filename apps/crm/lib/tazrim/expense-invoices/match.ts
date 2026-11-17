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
  | { invoiceId: string; status: 'choice'; expenseIds: string[] }

function compatibleExpenses(invoice: MatchInvoice, expenses: readonly MatchExpense[]): MatchExpense[] {
  return expenses
    .filter((expense) => expenseCompatible(invoice, expense))
    .sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Suggestions only. Several compatible expenses are a choice: nothing is picked.
 * The cash-event amount changes later, when the user confirms one of them.
 * Expenses of another company never match.
 */
export function matchInvoice(
  invoice: MatchInvoice,
  expenses: readonly MatchExpense[],
): InvoiceMatch {
  const found = compatibleExpenses(invoice, expenses)
  if (found.length === 0) return { invoiceId: invoice.id, status: 'none' }
  if (found.length > 1) {
    return { invoiceId: invoice.id, status: 'choice', expenseIds: found.map((row) => row.id) }
  }
  const expense = found[0]
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
 * Suggestions for the month. Does not choose among several fits, and does not
 * write. Two invoices may both suggest the same expense; confirming one of
 * them is what reserves it.
 */
export function reconcileInvoices(
  invoices: readonly MatchInvoice[],
  expenses: readonly MatchExpense[],
): Reconciliation {
  const preliminary = expenses.filter((expense) => isPreliminaryExpense(expense.source))
  const matches = invoices.map((invoice) => matchInvoice(invoice, preliminary))
  const suggested = new Set(
    matches.flatMap((match) =>
      match.status === 'matched' ? [match.expenseId] : match.status === 'choice' ? match.expenseIds : [],
    ),
  )
  return {
    matches,
    expensesWithoutInvoice: preliminary.filter((expense) => !suggested.has(expense.id)),
  }
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
