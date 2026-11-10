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

// Which account receives AluminCRM payments. One default per company (a partial
// unique index enforces it), so the old default is cleared first. If the second
// step fails the company is left with no default, which is the safe state:
// the sync then marks CRM payments "needs account" instead of guessing.
// Already-synced payments move to the new account on the next CRM sync.
export async function setCrmDefaultAccount(formData: FormData) {
  const bank_account_id = String(formData.get("bank_account_id") ?? "");
  if (!bank_account_id) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data: account, error: accountError } = await supabase
    .from("tz_bank_accounts")
    .select("id")
    .eq("id", bank_account_id)
    .eq("company_id", company_id)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Не удалось прочитать счёт: ${accountError.message}`);
  }
  if (!account) throw new Error("Счёт не найден");

  const { error: clearError } = await supabase
    .from("tz_bank_accounts")
    .update({ is_crm_default: false })
    .eq("company_id", company_id)
    .eq("is_crm_default", true);

  if (clearError) {
    throw new Error(`Не удалось сменить счёт по умолчанию: ${clearError.message}`);
  }

  const { data: updated, error } = await supabase
    .from("tz_bank_accounts")
    .update({ is_crm_default: true })
    .eq("id", account.id)
    .eq("company_id", company_id)
    .select("id");

  if (error) {
    throw new Error(`Не удалось сохранить счёт по умолчанию: ${error.message}`);
  }
  // RLS can make an update succeed with zero affected rows — surface that.
  if (!updated || updated.length === 0) {
    throw new Error("Счёт по умолчанию не сохранён (нет прав на изменение)");
  }

  revalidateBalanceViews();
  revalidatePath("/app/admin/tazrim/crm");
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
