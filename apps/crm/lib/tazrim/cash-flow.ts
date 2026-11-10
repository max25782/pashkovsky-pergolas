import { addDays, formatMoney } from "@/lib/tazrim/format";
import { ruleOccurrences } from "@/lib/tazrim/recurring-schedule";

export type RiskLevel = "red" | "amber" | "green";
export type FlowDirection = "in" | "out";

// A planned money movement: a planned cash_event, or a recurring rule that has
// not been turned into a cash_event yet.
export interface CashFlowItem {
  key: string;
  date: string;
  direction: FlowDirection;
  vendorName: string;
  description: string | null;
  // null = variable or unset amount, unknown until the charge arrives. It is
  // never summed (see sumFlows) and is listed separately via variableFlows.
  amount: number | null;
  // Rough figure saved on a variable charge; display only, never summed.
  amountEstimate: number | null;
  typeLabel: string;
  sourceHref: string;
}

export interface EventRow {
  id: string;
  type: string;
  amount: number | string;
  due_date: string;
  status: string;
  notes: string | null;
  payment_method: string | null;
  recurring_rule_id: string | null;
  debt_id: string | null;
  vendors: { name: string } | null;
  checks: unknown;
}

export interface RuleRow {
  id: string;
  label: string;
  amount: number | string | null;
  is_variable: boolean;
  frequency: string;
  // Payment day (and month for yearly) plus start date for a future rule.
  // Not advanced by anything, so never used as "the" date of a charge.
  next_due_date: string | null;
  vendors: { name: string } | null;
}

// Dates in [from, to] for which recurring rules are expanded.
export interface ForecastWindow {
  from: string;
  to: string;
}

export interface ProjectionDay {
  date: string;
  income: number;
  expense: number;
  // End-of-day balance.
  balance: number;
}

export interface RiskSummary {
  minBalance: number;
  minDate: string;
  level: RiskLevel;
  // First day whose balance is under the safety line, or null.
  riskStartDate: string | null;
  // Balance under which a day counts as "in the risk zone".
  riskLine: number;
}

// Below this share of the starting balance the position is a "risk zone".
const RISK_ZONE_RATIO = 0.15;

const TYPE_HREFS: Record<string, string> = {
  שיק: "/app/admin/tazrim/checks",
  "הוראת קבע": "/app/admin/tazrim/recurring",
  "תשלום חוב": "/app/admin/tazrim/debts",
};
const DEFAULT_HREF = "/app/admin/tazrim/expenses";

function hasLinkedCheck(checks: unknown): boolean {
  if (Array.isArray(checks)) return checks.length > 0;
  return checks !== null && checks !== undefined;
}

export function getEventTypeLabel(e: EventRow): string {
  if (hasLinkedCheck(e.checks)) return "שיק";
  if (e.recurring_rule_id !== null) return "הוראת קבע";
  if (e.debt_id !== null) return "תשלום חוב";
  if (e.payment_method === "bank_transfer") return "העברה בנקאית";
  if (e.payment_method === "cash") return "מזומן";
  if (e.payment_method === "card") return "כרטיס אשראי";
  return "אחר";
}

function hrefForType(typeLabel: string): string {
  return TYPE_HREFS[typeLabel] ?? DEFAULT_HREF;
}

// Planned cash events and not-yet-materialized recurring rules merged into one
// chronological list, so totals, risk and tables all read the same flows.
//
// Rule occurrences come from the rule's frequency and payment day inside
// `window`, not from its saved next_due_date (see recurring-schedule.ts).
// `coveredBy` is every event that may already stand for a rule occurrence
// (defaults to `events`); pass the unfiltered list when `events` is filtered.
export function buildFlows(
  events: EventRow[],
  rules: RuleRow[],
  window: ForecastWindow,
  coveredBy: EventRow[] = events
): CashFlowItem[] {
  const fromEvents = events.map((e): CashFlowItem => {
    const typeLabel = getEventTypeLabel(e);
    return {
      key: `event-${e.id}`,
      date: e.due_date,
      direction: e.type === "income" ? "in" : "out",
      vendorName: e.vendors?.name ?? e.notes ?? "—",
      description: e.vendors?.name ? e.notes : null,
      amount: Number(e.amount),
      amountEstimate: null,
      typeLabel,
      sourceHref: hrefForType(typeLabel),
    };
  });

  // A rule occurrence already turned into an event (same rule, same date, any
  // status) is represented by that event; adding it again would double count.
  const materialized = new Set(
    coveredBy
      .filter((e) => e.recurring_rule_id !== null)
      .map((e) => `${e.recurring_rule_id}|${e.due_date}`)
  );

  const fromRules = rules.flatMap((r): CashFlowItem[] =>
    ruleOccurrences(r, window.from, window.to)
      .filter((date) => !materialized.has(`${r.id}|${date}`))
      .map((date): CashFlowItem => {
        const typeLabel = "הוראת קבע";
        const rawAmount = r.amount !== null ? Number(r.amount) : null;
        // A variable charge is never summed, even when a rough amount is saved.
        const isUnknown = r.is_variable || rawAmount === null;
        return {
          key: `rule-${r.id}-${date}`,
          date,
          direction: "out",
          vendorName: r.vendors?.name ?? r.label,
          description: r.vendors?.name ? r.label : null,
          amount: isUnknown ? null : rawAmount,
          amountEstimate: isUnknown ? rawAmount : null,
          typeLabel,
          sourceHref: hrefForType(typeLabel),
        };
      })
  );

  return [...fromEvents, ...fromRules].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// Projection input: only still-planned events. Cleared money (including CRM
// payments counted in the account balance, see lib/tazrim/account-balance.ts)
// is already inside the starting balance, so it must never be projected again.
export function buildPlannedFlows(
  events: EventRow[],
  rules: RuleRow[],
  window: ForecastWindow
): CashFlowItem[] {
  return buildFlows(
    events.filter((e) => e.status === "planned"),
    rules,
    window,
    events
  );
}

export function flowTitle(f: CashFlowItem): string {
  return f.description ? `${f.vendorName} · ${f.description}` : f.vendorName;
}

export const AMOUNT_NOT_SET_LABEL = "סכום לא הוגדר (משתנה)";

export function flowAmount(f: CashFlowItem): string {
  if (f.amount !== null) return formatMoney(f.amount);
  return f.amountEstimate !== null
    ? `משתנה · הערכה ${formatMoney(f.amountEstimate)}`
    : AMOUNT_NOT_SET_LABEL;
}

// Flows whose amount is unknown. They are not in any total; screens list them
// next to the totals so they are neither lost nor counted as 0.
export function variableFlows(flows: CashFlowItem[]): CashFlowItem[] {
  return flows.filter((f) => f.amount === null);
}

export interface RecurringMonthForecast {
  // Every charge of the month in date order, including ones before today.
  flows: CashFlowItem[];
  // Sum of the charges with a known amount.
  fixedTotal: number;
  // Charges with an unknown amount, kept out of fixedTotal.
  variable: CashFlowItem[];
}

// Recurring charges of the calendar month [monthStart, monthEnd]: rule
// occurrences by frequency and payment day, plus events already generated
// from a rule. Charges dated before today stay in: the month is the unit,
// an overdue saved date must not push a monthly charge out of it.
export function recurringMonthForecast(
  events: EventRow[],
  rules: RuleRow[],
  monthStart: string,
  monthEnd: string
): RecurringMonthForecast {
  const ruleEvents = events.filter(
    (e) =>
      e.recurring_rule_id !== null &&
      (e.status === "planned" || e.status === "cleared") &&
      e.due_date >= monthStart &&
      e.due_date <= monthEnd
  );
  const flows = buildFlows(ruleEvents, rules, {
    from: monthStart,
    to: monthEnd,
  });
  return {
    flows,
    fixedTotal: flows.reduce((total, f) => total + (f.amount ?? 0), 0),
    variable: variableFlows(flows),
  };
}

export function sumFlows(
  flows: CashFlowItem[],
  direction: FlowDirection,
  fromDate: string,
  toDate: string
): number {
  return flows
    .filter(
      (f) => f.direction === direction && f.date >= fromDate && f.date <= toDate
    )
    .reduce((total, f) => total + (f.amount ?? 0), 0);
}

// End-of-day balance for every date in [fromDate, toDate], starting from
// `startBalance` at the beginning of fromDate.
export function projectBalance(
  startBalance: number,
  flows: CashFlowItem[],
  fromDate: string,
  toDate: string
): ProjectionDay[] {
  const days: ProjectionDay[] = [];
  let running = startBalance;

  for (let date = fromDate; date <= toDate; date = addDays(date, 1)) {
    let income = 0;
    let expense = 0;
    for (const f of flows) {
      if (f.date !== date) continue;
      if (f.direction === "in") income += f.amount ?? 0;
      else expense += f.amount ?? 0;
    }
    running += income - expense;
    days.push({ date, income, expense, balance: running });
  }

  return days;
}

export function summarizeRisk(
  startBalance: number,
  days: ProjectionDay[]
): RiskSummary {
  const riskLine = Math.max(startBalance * RISK_ZONE_RATIO, 0);

  let minBalance = startBalance;
  let minDate = days[0]?.date ?? "";
  for (const d of days) {
    if (d.balance < minBalance) {
      minBalance = d.balance;
      minDate = d.date;
    }
  }

  let level: RiskLevel = "green";
  if (minBalance < 0) level = "red";
  else if (minBalance < startBalance * RISK_ZONE_RATIO) level = "amber";

  const riskStartDate = days.find((d) => d.balance < riskLine)?.date ?? null;

  return { minBalance, minDate, level, riskStartDate, riskLine };
}
