import { createHash } from "node:crypto";
import { roundMoney } from "@/lib/finance/money";
import { computeDealFinance, vatPayableByPaymentMonth } from "@/lib/deals/deal-finance";
import type { PensionReport } from "@/lib/workers/pension-report";

// Calculated cash events fed from AluminCRM: VAT payable to the tax authority
// and the employer's pension / pitzuim payment. Pure helpers: no I/O, so the
// sync action stays thin and the rules live in one place.
//
// Both are derived numbers, not documents. They carry their own `source`
// values so they are visibly "calculated", never collide with hand-entered
// taxes or payments (those have other sources / no external id), and can be
// cleaned up independently of payroll.

export const VAT_SOURCE = "alumincrm_vat";
export const PENSION_SOURCE = "alumincrm_pension";
export const CALCULATED_SOURCES = [VAT_SOURCE, PENSION_SOURCE];

// VAT for the sales of month M is paid on this day of month M+1 (the periodic
// VAT report is due by the 15th; it is a tunable default, not a legal claim).
export const VAT_PAYDAY_OF_MONTH = 15;
// Pension and pitzuim for month M leave the account on this day of month M+1.
export const PENSION_PAYDAY_OF_MONTH = 15;

export const VAT_LABEL = "НДС к уплате";
export const VAT_REFUND_LABEL = "НДС к возмещению";
export const PENSION_LABEL = "Пенсия и пицуим";
const CALCULATED_MARK = "расчётный";

export interface CalculatedCashRow {
  company_id: string;
  // A VAT refund is money coming in, so it is an income row.
  type: "income" | "expense";
  amount: number;
  currency: string;
  due_date: string;
  status: "planned" | "cleared";
  cleared_date: string | null;
  source: string;
  external_source: string;
  external_id: string;
  notes: string;
}

function monthParts(month: string): { year: number; month: number } {
  return { year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) };
}

export function nextMonth(month: string): string {
  const { year, month: m } = monthParts(month);
  return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;
}

function dayOf(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return `${month.slice(5, 7)}/${month.slice(0, 4)}`;
}

// Stable id so repeated syncs upsert the same row. Formatted as a UUID so it
// is valid whether external_id is text or uuid (same scheme as payroll).
function stableId(kind: string, companyId: string, month: string): string {
  const hex = createHash("sha1")
    .update(`alumincrm-${kind}:${companyId}:${month}`)
    .digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

export function vatExternalId(companyId: string, dueMonth: string): string {
  return stableId("vat", companyId, dueMonth);
}

export function pensionExternalId(companyId: string, dueMonth: string): string {
  return stableId("pension", companyId, dueMonth);
}

function statusFor(dueDate: string, today: string): Pick<CalculatedCashRow, "status" | "cleared_date"> {
  return dueDate <= today
    ? { status: "cleared", cleared_date: dueDate }
    : { status: "planned", cleared_date: null };
}

export interface VatDealInput {
  id: string;
  price: number | string | null;
  /** Material cost with VAT (deals.my_cost). */
  my_cost: number | string | null;
  /** Worker cost with the employer coefficient. Workers carry no VAT. */
  labor?: number | string | null;
  payments: ReadonlyArray<{ id: string; amount: number; paid_at: string }>;
  /**
   * Date used for a deal with no payments yet: its forecast (or completion)
   * date, as the income row for that deal is placed. The whole price is
   * treated as received on that date.
   */
  fallbackDate: string;
}

export interface BuildVatRowsInput {
  companyId: string;
  /** Today in Israel, YYYY-MM-DD. */
  today: string;
  vatPercent: number;
  deals: readonly VatDealInput[];
}

/**
 * One row per due month. Month M of received money (payment date, or the
 * forecast date for a deal without payments) is paid in M+1. VAT payable is
 * the VAT on sales minus the VAT on materials, so a month where materials
 * exceed sales is negative and becomes an explicit refund row, never zero.
 * Months already due before the current month are history and are left alone.
 */
export function buildVatRows(input: BuildVatRowsInput): CalculatedCashRow[] {
  const currentMonth = input.today.slice(0, 7);
  const totalsByMonth = new Map<string, number>();

  for (const deal of input.deals) {
    const finance = computeDealFinance({
      price: deal.price,
      materials: deal.my_cost,
      labor: deal.labor ?? 0,
      vatPercent: input.vatPercent,
    });
    if (finance.price <= 0) continue;

    const dated =
      deal.payments.length > 0
        ? deal.payments.map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paid_at }))
        : [{ id: deal.id, amount: finance.price, paidAt: deal.fallbackDate }];

    for (const [month, vat] of vatPayableByPaymentMonth(finance, dated)) {
      totalsByMonth.set(month, roundMoney((totalsByMonth.get(month) ?? 0) + vat));
    }
  }

  const rows: CalculatedCashRow[] = [];
  for (const [paymentMonth, total] of totalsByMonth) {
    const dueMonth = nextMonth(paymentMonth);
    if (dueMonth < currentMonth || total === 0) continue;

    const dueDate = dayOf(dueMonth, VAT_PAYDAY_OF_MONTH);
    const isRefund = total < 0;
    rows.push({
      company_id: input.companyId,
      type: isRefund ? "income" : "expense",
      amount: Math.abs(total),
      currency: "ILS",
      due_date: dueDate,
      ...statusFor(dueDate, input.today),
      source: VAT_SOURCE,
      external_source: "alumincrm",
      external_id: vatExternalId(input.companyId, dueMonth),
      notes: `${isRefund ? VAT_REFUND_LABEL : VAT_LABEL} за ${monthLabel(paymentMonth)} · ${CALCULATED_MARK}`,
    });
  }
  return rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export interface BuildPensionRowsInput {
  companyId: string;
  today: string;
  /** One report per worked month (previous and current month). */
  reports: readonly PensionReport[];
}

/** One expense row per worked month, paid in the following month. */
export function buildPensionRows(input: BuildPensionRowsInput): CalculatedCashRow[] {
  const rows: CalculatedCashRow[] = [];
  for (const report of input.reports) {
    if (report.total <= 0) continue;
    const dueMonth = nextMonth(report.month);
    const dueDate = dayOf(dueMonth, PENSION_PAYDAY_OF_MONTH);
    rows.push({
      company_id: input.companyId,
      type: "expense",
      amount: report.total,
      currency: "ILS",
      due_date: dueDate,
      ...statusFor(dueDate, input.today),
      source: PENSION_SOURCE,
      external_source: "alumincrm",
      external_id: pensionExternalId(input.companyId, dueMonth),
      notes: `${PENSION_LABEL} за ${monthLabel(report.month)} · ${CALCULATED_MARK}`,
    });
  }
  return rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
}
