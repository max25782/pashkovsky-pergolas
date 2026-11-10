"use server";

import { revalidatePath } from "next/cache";
import { requireTazrimActionContext } from "@/lib/tazrim/guard";
import { buildPaymentMode } from "@/lib/tazrim/payment-methods";
import { TAZRIM_BASE_PATH } from "@/lib/tazrim/access";

export async function addVendor(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const vendor_type = String(formData.get("vendor_type") ?? "other");
  const payment_method = String(formData.get("payment_method") ?? "").trim();
  const payment_details = String(formData.get("payment_details") ?? "").trim();

  if (!name) return;

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  await supabase.from("tz_vendors").insert({
    company_id,
    name,
    vendor_type,
    payment_mode: buildPaymentMode(payment_method, payment_details),
  });

  revalidatePath(`${TAZRIM_BASE_PATH}/vendors`);
}

interface DeleteVendorResult {
  error?: string;
}

export async function deleteVendor(id: string): Promise<DeleteVendorResult> {
  if (!id) return { error: "מזהה ספק חסר" };

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  // Refuse to delete a vendor that still has payments (incl. checks) attached,
  // so we never orphan or silently cascade-destroy financial records.
  const { count, error: countError } = await supabase
    .from("tz_cash_events")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", id)
    .eq("company_id", company_id);

  if (countError) return { error: countError.message };
  if (count && count > 0)
    return { error: `לא ניתן למחוק: לספק יש ${count} תשלומים/שיקים משויכים` };

  const { data, error } = await supabase
    .from("tz_vendors")
    .delete()
    .eq("id", id)
    .eq("company_id", company_id)
    .select("id");

  if (error) return { error: error.message };
  // RLS can make a delete succeed with zero affected rows — surface that.
  if (!data || data.length === 0)
    return { error: "המחיקה לא בוצעה (אין הרשאה או שהספק לא קיים)" };

  revalidatePath(`${TAZRIM_BASE_PATH}/vendors`);
  return {};
}
