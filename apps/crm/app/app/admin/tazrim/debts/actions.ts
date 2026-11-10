"use server";

import { revalidatePath } from "next/cache";
import { requireTazrimActionContext } from "@/lib/tazrim/guard";

export async function setOpeningDebt(formData: FormData) {
  const vendor_id = String(formData.get("vendor_id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());

  if (!vendor_id || Number.isNaN(amount) || amount < 0) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data: existing, error: lookupError } = await supabase
    .from("tz_supplier_debts")
    .select("id")
    .eq("company_id", company_id)
    .eq("vendor_id", vendor_id)
    .maybeSingle();

  if (lookupError) return;

  if (existing) {
    // Re-setting the opening balance is treated as a correction of the start
    // point, so the current balance is reset to the same value.
    await supabase
      .from("tz_supplier_debts")
      .update({
        opening_balance: amount,
        current_balance: amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("company_id", company_id);
  } else {
    await supabase.from("tz_supplier_debts").insert({
      company_id,
      vendor_id,
      opening_balance: amount,
      current_balance: amount,
    });
  }

  revalidatePath("/app/admin/tazrim/debts");
  revalidatePath("/app/admin/tazrim");
}

export async function recordDebtPayment(formData: FormData) {
  const debt_id = String(formData.get("debt_id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const payment_date = String(formData.get("payment_date") ?? "");

  if (!debt_id || !payment_date || Number.isNaN(amount) || amount <= 0) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data: debt, error: debtError } = await supabase
    .from("tz_supplier_debts")
    .select("id, vendor_id, current_balance")
    .eq("id", debt_id)
    .eq("company_id", company_id)
    .maybeSingle();

  if (debtError || !debt) return;

  // 1. the payment itself, so it shows up in the overall cash flow
  const { data: cashEvent, error: eventError } = await supabase
    .from("tz_cash_events")
    .insert({
      company_id,
      type: "expense",
      amount,
      due_date: payment_date,
      status: "cleared",
      cleared_date: payment_date,
      source: "manual",
      debt_id: debt.id,
      vendor_id: debt.vendor_id,
    })
    .select("id")
    .single();

  if (eventError || !cashEvent) return;

  // 2. reduce the debt, never below zero. The current_balance match makes the
  // update a no-op if someone else changed the balance in the meantime.
  const previousBalance = Number(debt.current_balance);
  const { data: updated, error: updateError } = await supabase
    .from("tz_supplier_debts")
    .update({
      current_balance: Math.max(0, previousBalance - amount),
      updated_at: new Date().toISOString(),
    })
    .eq("id", debt.id)
    .eq("company_id", company_id)
    .eq("current_balance", debt.current_balance)
    .select("id");

  if (updateError || !updated || updated.length === 0) {
    // Two separate requests can't share a transaction; undo the cash event so
    // the payment isn't counted without reducing the debt.
    await supabase
      .from("tz_cash_events")
      .delete()
      .eq("id", cashEvent.id)
      .eq("company_id", company_id);
    return;
  }

  revalidatePath("/app/admin/tazrim/debts");
  revalidatePath("/app/admin/tazrim");
}
