import { addDays, formatMoney } from "@/lib/tazrim/format";

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
  // null = variable amount, unknown until the charge arrives; counts as 0.
  amount: number | null;
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
  next_due_date: string | null;
  vendors: { name: string } | null;
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
export function buildFlows(
  events: EventRow[],
  rules: RuleRow[]
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
      typeLabel,
      sourceHref: hrefForType(typeLabel),
    };
  });

  const fromRules = rules.flatMap((r): CashFlowItem[] => {
    if (r.next_due_date === null) return [];
    const typeLabel = "הוראת קבע";
    return [
      {
        key: `rule-${r.id}`,
        date: r.next_due_date,
        direction: "out",
        vendorName: r.vendors?.name ?? r.label,
        description: r.vendors?.name ? r.label : null,
        amount: r.amount !== null ? Number(r.amount) : null,
        typeLabel,
        sourceHref: hrefForType(typeLabel),
      },
    ];
  });

  return [...fromEvents, ...fromRules].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export function flowTitle(f: CashFlowItem): string {
  return f.description ? `${f.vendorName} · ${f.description}` : f.vendorName;
}

export function flowAmount(f: CashFlowItem): string {
  return f.amount === null ? "משתנה" : formatMoney(f.amount);
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
