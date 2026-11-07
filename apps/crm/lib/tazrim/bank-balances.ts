import type { TazrimSupabase } from "@/lib/tazrim/guard";

type Supabase = TazrimSupabase;

export interface AccountBalance {
  id: string;
  label: string;
  purpose: string | null;
  balance: number | null;
  snapshot_at: string | null;
}

export interface AccountBalancesResult {
  accounts: AccountBalance[];
  error: string | null;
}

// Snapshots are append-only history; the current balance of an account is its
// most recent snapshot. Queried per account (not one big ordered scan) so a
// long history can never push a quiet account's latest row past the row cap.
export async function getAccountBalances(
  supabase: Supabase
): Promise<AccountBalancesResult> {
  const { data: accounts, error } = await supabase
    .from("tz_bank_accounts")
    .select("id, label, purpose")
    .order("created_at", { ascending: true });

  if (error) return { accounts: [], error: error.message };

  const results = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const { data: snapshot, error: snapshotError } = await supabase
        .from("tz_bank_balance_snapshots")
        .select("balance, snapshot_at")
        .eq("bank_account_id", account.id)
        .order("snapshot_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        account: {
          id: account.id,
          label: account.label,
          purpose: account.purpose,
          balance: snapshot ? Number(snapshot.balance) : null,
          snapshot_at: snapshot?.snapshot_at ?? null,
        } satisfies AccountBalance,
        error: snapshotError?.message ?? null,
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
