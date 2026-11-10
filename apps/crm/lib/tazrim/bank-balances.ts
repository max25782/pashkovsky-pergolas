import type { TazrimSupabase } from "@/lib/tazrim/guard";
import {
  CRM_INCOME_SOURCE,
  computeAccountBalance,
  type BalanceEvent,
  type BalanceSnapshot,
} from "@/lib/tazrim/account-balance";
import { dateInIsrael } from "@/lib/tazrim/format";

type Supabase = TazrimSupabase;

export interface AccountBalance {
  id: string;
  label: string;
  purpose: string | null;
  // Snapshot + CRM payments cleared after it. null = no snapshot yet.
  balance: number | null;
  // Timestamp of the latest manual snapshot.
  snapshot_at: string | null;
  isCrmDefault: boolean;
  snapshotBalance: number | null;
  // Israel calendar date of the snapshot (the "Y" in "snapshot X on date Y").
  snapshotDate: string | null;
  crmTotal: number;
  crmCount: number;
}

export interface AccountBalancesResult {
  accounts: AccountBalance[];
  error: string | null;
}

const EVENT_PAGE_SIZE = 1000;

// All CRM income that could count for an account after its snapshot day. Paged
// so a long history can never be silently cut off at the API row cap.
async function loadCrmEventsAfter(
  supabase: Supabase,
  accountId: string,
  snapshotDate: string
): Promise<{ events: BalanceEvent[]; error: string | null }> {
  const events: BalanceEvent[] = [];

  for (let from = 0; ; from += EVENT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("tz_cash_events")
      .select(
        "bank_account_id, type, source, status, currency, amount, cleared_date, needs_account"
      )
      .eq("bank_account_id", accountId)
      .eq("type", "income")
      .eq("source", CRM_INCOME_SOURCE)
      .eq("status", "cleared")
      .gt("cleared_date", snapshotDate)
      .order("cleared_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + EVENT_PAGE_SIZE - 1);

    if (error) return { events, error: error.message };
    events.push(...((data ?? []) as BalanceEvent[]));
    if ((data ?? []).length < EVENT_PAGE_SIZE) break;
  }

  return { events, error: null };
}

// Snapshots are append-only history; an account's balance starts from its most
// recent snapshot (queried per account, not one big ordered scan, so a long
// history can never push a quiet account's latest row past the row cap) and
// adds the CRM payments cleared after it (computeAccountBalance).
export async function getAccountBalances(
  supabase: Supabase
): Promise<AccountBalancesResult> {
  const { data: accounts, error } = await supabase
    .from("tz_bank_accounts")
    .select("id, label, purpose, is_crm_default")
    .order("created_at", { ascending: true });

  if (error) return { accounts: [], error: error.message };

  const results = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const { data: snapshotRow, error: snapshotError } = await supabase
        .from("tz_bank_balance_snapshots")
        .select("bank_account_id, balance, snapshot_at")
        .eq("bank_account_id", account.id)
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const snapshot: BalanceSnapshot | null = snapshotRow
        ? {
            bank_account_id: snapshotRow.bank_account_id,
            balance: snapshotRow.balance,
            snapshot_at: snapshotRow.snapshot_at,
          }
        : null;

      const eventsResult = snapshot
        ? await loadCrmEventsAfter(
            supabase,
            account.id,
            dateInIsrael(snapshot.snapshot_at)
          )
        : { events: [], error: null };

      const breakdown = computeAccountBalance(snapshot, eventsResult.events);

      return {
        account: {
          id: account.id,
          label: account.label,
          purpose: account.purpose,
          balance: breakdown.balance,
          snapshot_at: snapshot?.snapshot_at ?? null,
          isCrmDefault: account.is_crm_default === true,
          snapshotBalance: breakdown.snapshotBalance,
          snapshotDate: breakdown.snapshotDate,
          crmTotal: breakdown.crmTotal,
          crmCount: breakdown.crmCount,
        } satisfies AccountBalance,
        error: snapshotError?.message ?? eventsResult.error,
      };
    })
  );

  return {
    accounts: results.map((r) => r.account),
    error: results.find((r) => r.error !== null)?.error ?? null,
  };
}

// Returns null when no account has any snapshot yet (balance is "not set"),
// which is different from a real balance of 0.
export function sumBalances(accounts: AccountBalance[]): number | null {
  const known = accounts.filter((a) => a.balance !== null);
  if (known.length === 0) return null;
  return known.reduce((total, a) => total + (a.balance ?? 0), 0);
}
