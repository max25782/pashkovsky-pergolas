import type { TazrimSupabase } from "@/lib/tazrim/guard";
import { getAccountBalances, sumBalances } from "@/lib/tazrim/bank-balances";
import { addDays } from "@/lib/tazrim/format";
import {
  buildPlannedFlows,
  type CashFlowItem,
  type EventRow,
  type RuleRow,
} from "@/lib/tazrim/cash-flow";
import type { AccountBalance } from "@/lib/tazrim/bank-balances";

type Supabase = TazrimSupabase;

export const HORIZON_DAYS = 14;

export interface TodayFlow {
  income: number;
  incomeCount: number;
  expense: number;
  expenseCount: number;
}

export interface CashPicture {
  accounts: AccountBalance[];
  // null = no bank snapshot exists yet (different from a real balance of 0).
  totalBalance: number | null;
  lastUpdatedAt: string | null;
  flows: CashFlowItem[];
  today: TodayFlow;
  errors: string[];
}

// Everything the daily screen, weekly report and debts screen share: current
// balance plus every planned flow in the next HORIZON_DAYS days.
export async function loadCashPicture(
  supabase: Supabase,
  today: string,
  horizonDays: number = HORIZON_DAYS
): Promise<CashPicture> {
  const horizonEnd = addDays(today, horizonDays);

  const [balancesResult, eventsResult, rulesResult] = await Promise.all([
    getAccountBalances(supabase),
    supabase
      .from("tz_cash_events")
      .select(
        "id, type, amount, due_date, status, notes, payment_method, recurring_rule_id, debt_id, vendors:tz_vendors(name), checks:tz_checks(check_number, bank_name)"
      )
      .in("status", ["planned", "cleared"])
      .gte("due_date", today)
      .lte("due_date", horizonEnd)
      .order("due_date", { ascending: true }),
    supabase
      .from("tz_recurring_rules")
      .select("id, label, amount, is_variable, next_due_date, vendors:tz_vendors(name)")
      .gte("next_due_date", today)
      .lte("next_due_date", horizonEnd)
      .order("next_due_date", { ascending: true }),
  ]);

  const events = (eventsResult.data ?? []) as unknown as EventRow[];

  // Today's flow counts planned and already-cleared items (display only, never
  // added to the balance); projections only use planned ones, because cleared
  // money is already in the account balance (snapshot + CRM payments cleared
  // after it).
  const todayEvents = events.filter((e) => e.due_date === today);
  const todayIncome = todayEvents.filter((e) => e.type === "income");
  const todayExpense = todayEvents.filter((e) => e.type !== "income");
  const sum = (rows: EventRow[]) =>
    rows.reduce((total, e) => total + Number(e.amount), 0);

  const lastUpdatedAt = balancesResult.accounts.reduce<string | null>(
    (latest, a) =>
      a.snapshot_at !== null && (latest === null || a.snapshot_at > latest)
        ? a.snapshot_at
        : latest,
    null
  );

  const errors = [
    balancesResult.error,
    eventsResult.error?.message ?? null,
    rulesResult.error?.message ?? null,
  ].filter((e): e is string => e !== null);

  return {
    accounts: balancesResult.accounts,
    totalBalance: sumBalances(balancesResult.accounts),
    lastUpdatedAt,
    flows: buildPlannedFlows(
      events,
      (rulesResult.data ?? []) as unknown as RuleRow[]
    ),
    today: {
      income: sum(todayIncome),
      incomeCount: todayIncome.length,
      expense: sum(todayExpense),
      expenseCount: todayExpense.length,
    },
    errors,
  };
}
