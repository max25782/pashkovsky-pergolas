"use server";

import { revalidatePath } from "next/cache";
import { requireTazrimActionContext } from "@/lib/tazrim/guard";

function revalidateBalanceViews() {
  revalidatePath("/app/admin/tazrim/balance");
  revalidatePath("/app/admin/tazrim");
}

export async function addBankAccount(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();

  if (!label) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { error } = await supabase.from("tz_bank_accounts").insert({
    company_id,
    label,
    purpose: purpose || null,
  });

  if (error) return;

  revalidateBalanceViews();
}

export async function setBalance(formData: FormData) {
  const bank_account_id = String(formData.get("bank_account_id") ?? "");
  const balanceRaw = String(formData.get("balance") ?? "").trim();

  if (!bank_account_id || balanceRaw === "") return;

  // Negative balances (overdraft) are valid.
  const balance = Number(balanceRaw);
  if (Number.isNaN(balance)) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data: account, error: accountError } = await supabase
    .from("tz_bank_accounts")
    .select("id")
    .eq("id", bank_account_id)
    .eq("company_id", company_id)
    .maybeSingle();

  if (accountError || !account) return;

  // Always a new row: snapshots are history, the latest one is the balance.
  const { error } = await supabase.from("tz_bank_balance_snapshots").insert({
    company_id,
    bank_account_id: account.id,
    balance,
  });

  if (error) return;

  revalidateBalanceViews();
}
