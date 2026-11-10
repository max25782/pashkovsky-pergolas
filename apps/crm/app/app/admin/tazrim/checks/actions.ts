"use server";

import { revalidatePath } from "next/cache";
import { requireTazrimActionContext } from "@/lib/tazrim/guard";

export async function addCheck(formData: FormData) {
  const vendor_id = String(formData.get("vendor_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const due_date = String(formData.get("due_date") ?? "");
  const check_number = String(formData.get("check_number") ?? "").trim();
  const bank_name = String(formData.get("bank_name") ?? "").trim();

  const amount = Number(amountRaw);
  if (!vendor_id || !due_date || !amount || Number.isNaN(amount)) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  // 1. the cash event itself — this is what drives the dashboard / weekly report
  const { data: cashEvent, error } = await supabase
    .from("tz_cash_events")
    .insert({
      company_id,
      type: "expense",
      amount,
      vendor_id,
      due_date,
      source: "manual",
      status: "planned",
    })
    .select("id")
    .single();

  if (error || !cashEvent) return;

  // 2. check-specific details, 1:1 extension of the cash event
  await supabase.from("tz_checks").insert({
    company_id,
    cash_event_id: cashEvent.id,
    check_number: check_number || null,
    bank_name: bank_name || null,
  });

  revalidatePath("/app/admin/tazrim/checks");
}

interface DeleteCheckResult {
  error?: string;
}

export async function deleteCheck(id: string): Promise<DeleteCheckResult> {
  if (!id) return { error: "מזהה שיק חסר" };

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data: check, error: fetchError } = await supabase
    .from("tz_checks")
    .select("id, cash_event_id, check_number, bank_name, bounce_risk")
    .eq("id", id)
    .eq("company_id", company_id)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!check) return { error: "השיק לא נמצא" };

  // The check row references its cash event, so it must go first; the cash
  // event is what feeds the dashboard, so it has to be removed too.
  const { data: deletedChecks, error: checkError } = await supabase
    .from("tz_checks")
    .delete()
    .eq("id", check.id)
    .eq("company_id", company_id)
    .select("id");

  if (checkError) return { error: checkError.message };
  if (!deletedChecks || deletedChecks.length === 0)
    return { error: "המחיקה לא בוצעה (אין הרשאה)" };

  const { data: deletedEvents, error: eventError } = await supabase
    .from("tz_cash_events")
    .delete()
    .eq("id", check.cash_event_id)
    .eq("company_id", company_id)
    .select("id");

  if (eventError || !deletedEvents || deletedEvents.length === 0) {
    // Roll back the check row so we don't leave an expense with no check.
    await supabase.from("tz_checks").insert({
      company_id,
      cash_event_id: check.cash_event_id,
      check_number: check.check_number,
      bank_name: check.bank_name,
      bounce_risk: check.bounce_risk,
    });
    return {
      error: eventError?.message ?? "מחיקת התשלום המשויך נכשלה (אין הרשאה)",
    };
  }

  revalidatePath("/app/admin/tazrim/checks");
  return {};
}
