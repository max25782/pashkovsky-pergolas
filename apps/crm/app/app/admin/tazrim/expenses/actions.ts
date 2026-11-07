"use server";

import { revalidatePath } from "next/cache";
import { requireTazrimActionContext } from "@/lib/tazrim/guard";
import { todayInIsrael } from "@/lib/tazrim/format";
import { PAYROLL_APPROVED_SOURCE, PAYROLL_SOURCE } from "@/lib/tazrim/payroll";

// Keep in sync with PAYMENT_METHODS in ./page.tsx (values only; labels live there).
const PAYMENT_METHOD_VALUES = ["bank_transfer", "cash", "card"];

export async function addExpense(formData: FormData) {
  const vendor_id = String(formData.get("vendor_id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const due_date = String(formData.get("due_date") ?? "");
  const payment_method = String(formData.get("payment_method") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!vendor_id || !due_date || !amount || Number.isNaN(amount) || amount <= 0)
    return;
  if (!PAYMENT_METHOD_VALUES.includes(payment_method)) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { error } = await supabase.from("tz_cash_events").insert({
    company_id,
    type: "expense",
    amount,
    due_date,
    source: "manual",
    status: "planned",
    vendor_id,
    payment_method,
    notes: notes || null,
  });

  if (error) return;

  revalidatePath("/app/admin/tazrim/expenses");
  revalidatePath("/app/admin/tazrim");
}

// "check" is not a payment_method value: a check is a cash_event plus a row in
// `checks`, exactly like addCheck in app/checks/actions.ts.
const QUICK_MEANS = ["bank_transfer", "card", "check"];
const DEFAULT_CATEGORY = "אחר";

// Dashboard quick-add: description, amount, category, means. Due today, planned.
export async function addQuickExpense(formData: FormData) {
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const category =
    String(formData.get("category") ?? "").trim() || DEFAULT_CATEGORY;
  const meansRaw = String(formData.get("means") ?? "bank_transfer");
  const means = QUICK_MEANS.includes(meansRaw) ? meansRaw : "bank_transfer";

  if (!description || !amount || Number.isNaN(amount) || amount <= 0) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  // Use the structured category when it exists; otherwise keep the name in the
  // note so the information isn't lost.
  const { data: categoryRow } = await supabase
    .from("tz_expense_categories")
    .select("id")
    .eq("company_id", company_id)
    .eq("name", category)
    .maybeSingle();

  const { data: cashEvent, error } = await supabase
    .from("tz_cash_events")
    .insert({
      company_id,
      type: "expense",
      amount,
      due_date: todayInIsrael(),
      source: "manual",
      status: "planned",
      payment_method: means === "check" ? null : means,
      category_id: categoryRow?.id ?? null,
      notes: categoryRow ? description : `${category} · ${description}`,
    })
    .select("id")
    .single();

  if (error || !cashEvent) return;

  if (means === "check") {
    const { error: checkError } = await supabase
      .from("tz_checks")
      .insert({ company_id, cash_event_id: cashEvent.id });

    if (checkError) {
      await supabase
        .from("tz_cash_events")
        .delete()
        .eq("id", cashEvent.id)
        .eq("company_id", company_id);
      return;
    }
    revalidatePath("/app/admin/tazrim/checks");
  }

  revalidatePath("/app/admin/tazrim/expenses");
  revalidatePath("/app/admin/tazrim");
}

interface ExpenseMutationResult {
  error?: string;
}

// Editable only for rows that the expenses list shows: type=expense with a
// payment_method (checks have none and are managed on /checks).
export async function updateExpense(
  formData: FormData,
): Promise<ExpenseMutationResult> {
  const id = String(formData.get("id") ?? "");
  const vendor_id = String(formData.get("vendor_id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const due_date = String(formData.get("due_date") ?? "");
  const payment_method = String(formData.get("payment_method") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "מזהה הוצאה חסר" };
  if (!due_date) return { error: "תאריך חסר" };
  if (!amount || Number.isNaN(amount) || amount <= 0)
    return { error: "סכום לא תקין" };
  if (!PAYMENT_METHOD_VALUES.includes(payment_method))
    return { error: "אמצעי תשלום לא תקין" };

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data: existing, error: fetchError } = await supabase
    .from("tz_cash_events")
    .select("id, source")
    .eq("id", id)
    .eq("company_id", company_id)
    .eq("type", "expense")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "ההוצאה לא נמצאה" };

  // An edited CRM payroll row must be protected from being overwritten by the
  // next CRM sync, same mechanism as approvePayrollExpense.
  const source =
    existing.source === PAYROLL_SOURCE
      ? PAYROLL_APPROVED_SOURCE
      : existing.source;

  const { data: updated, error } = await supabase
    .from("tz_cash_events")
    .update({
      amount,
      due_date,
      payment_method,
      notes: notes || null,
      source,
      // Empty vendor select keeps the vendor-less rows (e.g. payroll) as is.
      ...(vendor_id ? { vendor_id } : {}),
    })
    .eq("id", id)
    .eq("company_id", company_id)
    .select("id");

  if (error) return { error: error.message };
  if (!updated || updated.length === 0)
    return { error: "העדכון לא בוצע (אין הרשאה)" };

  revalidateExpenseViews();
  return {};
}

export async function deleteExpense(id: string): Promise<ExpenseMutationResult> {
  if (!id) return { error: "מזהה הוצאה חסר" };

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data: existing, error: fetchError } = await supabase
    .from("tz_cash_events")
    .select("id, source, status")
    .eq("id", id)
    .eq("company_id", company_id)
    .eq("type", "expense")
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!existing) return { error: "ההוצאה לא נמצאה" };

  // The CRM sync recreates unapproved payroll rows, so a delete would silently
  // come back. Force the explicit path instead of pretending it worked.
  if (existing.source === PAYROLL_SOURCE)
    return {
      error: "שורת שכר אוטומטית מה-CRM. תקן את הסכום (יסומן כמאושר) או עדכן ב-CRM.",
    };

  const { data: deleted, error } = await supabase
    .from("tz_cash_events")
    .delete()
    .eq("id", id)
    .eq("company_id", company_id)
    .select("id");

  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0)
    return { error: "המחיקה לא בוצעה (אין הרשאה)" };

  revalidateExpenseViews();
  return {};
}

function revalidateExpenseViews() {
  revalidatePath("/app/admin/tazrim/expenses");
  revalidatePath("/app/admin/tazrim");
  revalidatePath("/app/admin/tazrim/weekly");
  revalidatePath("/app/admin/tazrim/monthly");
  revalidatePath("/app/admin/tazrim/crm");
}
