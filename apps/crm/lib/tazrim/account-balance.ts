import { dateInIsrael } from "@/lib/tazrim/format";

// Source label AluminCRM payments get in tz_cash_events once they are cleared.
export const CRM_INCOME_SOURCE = "alumincrm";
export const BALANCE_CURRENCY = "ILS";

export interface BalanceSnapshot {
  bank_account_id: string;
  balance: number | string;
  // timestamptz; only its Israel calendar date matters for the comparison.
  snapshot_at: string;
}

// The subset of tz_cash_events the balance maths needs.
export interface BalanceEvent {
  bank_account_id: string | null;
  type: string;
  source: string;
  status: string;
  currency: string | null;
  amount: number | string;
  cleared_date: string | null;
  needs_account?: boolean | null;
}

export interface AccountBalanceBreakdown {
  // null = no snapshot yet (a missing figure, not a real 0).
  balance: number | null;
  snapshotBalance: number | null;
  // Israel calendar date of the snapshot, YYYY-MM-DD.
  snapshotDate: string | null;
  crmTotal: number;
  crmCount: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// Does this event raise the balance of the snapshot's account? Pure predicate,
// kept next to the maths so the DB query filters and this stay in sync:
// cleared (and therefore not 'reversed') AluminCRM income, linked to this
// account, in ILS, cleared strictly after the snapshot day (money cleared on
// the snapshot day is assumed to be in the figure someone typed in).
export function countsTowardBalance(
  snapshot: BalanceSnapshot,
  snapshotDate: string,
  event: BalanceEvent
): boolean {
  if (event.type !== "income") return false;
  if (event.source !== CRM_INCOME_SOURCE) return false;
  if (event.status !== "cleared") return false;
  if (event.needs_account === true) return false;
  if (event.bank_account_id !== snapshot.bank_account_id) return false;
  if ((event.currency ?? "").trim().toUpperCase() !== BALANCE_CURRENCY) {
    return false;
  }
  if (event.cleared_date === null) return false;
  if (!(event.cleared_date > snapshotDate)) return false;
  return Number.isFinite(Number(event.amount));
}

// Balance of one account = latest manual snapshot + CRM payments cleared after
// it. The snapshot stays the source of truth: a new snapshot moves
// snapshotDate forward, which drops every earlier payment from the sum.
export function computeAccountBalance(
  snapshot: BalanceSnapshot | null,
  events: BalanceEvent[]
): AccountBalanceBreakdown {
  if (snapshot === null) {
    return {
      balance: null,
      snapshotBalance: null,
      snapshotDate: null,
      crmTotal: 0,
      crmCount: 0,
    };
  }

  const snapshotDate = dateInIsrael(snapshot.snapshot_at);
  const snapshotBalance = Number(snapshot.balance);

  let crmTotal = 0;
  let crmCount = 0;
  for (const event of events) {
    if (!countsTowardBalance(snapshot, snapshotDate, event)) continue;
    crmTotal += Number(event.amount);
    crmCount += 1;
  }

  // Money amounts, so keep cents exact instead of float noise (0.1 + 0.2).
  crmTotal = roundMoney(crmTotal);

  return {
    balance: roundMoney(snapshotBalance + crmTotal),
    snapshotBalance,
    snapshotDate,
    crmTotal,
    crmCount,
  };
}
