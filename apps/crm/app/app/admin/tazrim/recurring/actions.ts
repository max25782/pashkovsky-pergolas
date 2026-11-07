"use server";

import { revalidatePath } from "next/cache";
import { requireTazrimActionContext } from "@/lib/tazrim/guard";

const FREQUENCIES = ["monthly", "yearly"];

export async function addRecurringRule(formData: FormData) {
  const vendor_id = String(formData.get("vendor_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const is_variable = formData.get("is_variable") === "on";
  const frequencyRaw = String(formData.get("frequency") ?? "monthly");
  const next_due_date = String(formData.get("next_due_date") ?? "");

  const frequency = FREQUENCIES.includes(frequencyRaw) ? frequencyRaw : "monthly";

  if (!vendor_id || !label || !next_due_date) return;

  // Amount may be empty only for variable charges.
  let amount: number | null = null;
  if (amountRaw !== "") {
    amount = Number(amountRaw);
    if (Number.isNaN(amount) || amount < 0) return;
  } else if (!is_variable) {
    return;
  }

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { error } = await supabase.from("tz_recurring_rules").insert({
    company_id,
    vendor_id,
    label,
    amount,
    is_variable,
    frequency,
    next_due_date,
  });

  if (error) return;

  revalidatePath("/app/admin/tazrim/recurring");
}

interface DeleteRecurringRuleResult {
  error?: string;
}

export async function deleteRecurringRule(
  id: string
): Promise<DeleteRecurringRuleResult> {
  if (!id) return { error: "מזהה חיוב חסר" };

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  // Payments already generated from this rule reference it; don't orphan or
  // cascade-delete financial records.
  const { count, error: countError } = await supabase
    .from("tz_cash_events")
    .select("id", { count: "exact", head: true })
    .eq("recurring_rule_id", id)
    .eq("company_id", company_id);

  if (countError) return { error: countError.message };
  if (count && count > 0)
    return { error: `לא ניתן למחוק: לחיוב יש ${count} תשלומים משויכים` };

  const { data, error } = await supabase
    .from("tz_recurring_rules")
    .delete()
    .eq("id", id)
    .eq("company_id", company_id)
    .select("id");

  if (error) return { error: error.message };
  // RLS can make a delete succeed with zero affected rows — surface that.
  if (!data || data.length === 0)
    return { error: "המחיקה לא בוצעה (אין הרשאה או שהחיוב לא קיים)" };

  revalidatePath("/app/admin/tazrim/recurring");
  revalidatePath("/app/admin/tazrim");
  return {};
}
