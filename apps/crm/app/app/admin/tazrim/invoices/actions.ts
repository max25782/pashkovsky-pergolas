"use server";

import { revalidatePath } from "next/cache";
import { requireTazrimActionContext } from "@/lib/tazrim/guard";
import {
  applyInvoiceMatch,
  closeVatPeriod,
  confirmExpenseInvoice,
  createExpenseFromInvoice,
  parseDraftBody,
  rejectExpenseInvoice,
  reopenVatPeriod,
} from "@/lib/tazrim/expense-invoices/handlers";
import type { ValidationIssue } from "@/lib/tazrim/expense-invoices/validate";

export interface InvoiceActionResult {
  error?: string;
  issues?: ValidationIssue[];
}

function refresh() {
  revalidatePath("/app/admin/tazrim/invoices");
  revalidatePath("/app/admin/tazrim");
  revalidatePath("/app/admin/tazrim/expenses");
}

export async function confirmInvoiceAction(formData: FormData): Promise<InvoiceActionResult> {
  const ctx = await requireTazrimActionContext();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const draft = parseDraftBody(Object.fromEntries(formData.entries()));
  if (!invoiceId || !draft) return { error: "invalid" };
  const result = await confirmExpenseInvoice(ctx, invoiceId, draft);
  if (result.status >= 400) {
    return {
      error: String(result.body.error ?? "save_failed"),
      issues: Array.isArray(result.body.issues) ? (result.body.issues as ValidationIssue[]) : undefined,
    };
  }
  refresh();
  return { issues: Array.isArray(result.body.issues) ? (result.body.issues as ValidationIssue[]) : undefined };
}

export async function rejectInvoiceAction(formData: FormData): Promise<InvoiceActionResult> {
  const ctx = await requireTazrimActionContext();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const result = await rejectExpenseInvoice(ctx, invoiceId);
  if (result.status >= 400) return { error: String(result.body.error ?? "save_failed") };
  refresh();
  return {};
}

export async function applyMatchAction(formData: FormData): Promise<InvoiceActionResult> {
  const ctx = await requireTazrimActionContext();
  const result = await applyInvoiceMatch(
    ctx,
    String(formData.get("invoiceId") ?? ""),
    String(formData.get("expenseId") ?? ""),
  );
  if (result.status >= 400) return { error: String(result.body.error ?? "save_failed") };
  refresh();
  return {};
}

export async function createExpenseAction(formData: FormData): Promise<InvoiceActionResult> {
  const ctx = await requireTazrimActionContext();
  const result = await createExpenseFromInvoice(ctx, String(formData.get("invoiceId") ?? ""));
  if (result.status >= 400) return { error: String(result.body.error ?? "save_failed") };
  refresh();
  return {};
}

export async function closePeriodAction(formData: FormData): Promise<InvoiceActionResult> {
  const ctx = await requireTazrimActionContext();
  const result = await closeVatPeriod(ctx, String(formData.get("period") ?? ""), String(formData.get("note") ?? ""));
  if (result.status >= 400) return { error: String(result.body.error ?? "save_failed") };
  refresh();
  return {};
}

export async function reopenPeriodAction(formData: FormData): Promise<InvoiceActionResult> {
  const ctx = await requireTazrimActionContext();
  const result = await reopenVatPeriod(
    ctx,
    String(formData.get("period") ?? ""),
    String(formData.get("note") ?? ""),
  );
  if (result.status >= 400) return { error: String(result.body.error ?? "save_failed") };
  refresh();
  return {};
}
