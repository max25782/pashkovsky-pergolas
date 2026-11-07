"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireTazrimActionContext, type TazrimSupabase } from "@/lib/tazrim/guard";
import { todayInIsrael } from "@/lib/tazrim/format";
import {
  PAYROLL_APPROVED_SOURCE,
  PAYROLL_CATEGORY,
  PAYROLL_SOURCE,
  PAYROLL_SOURCES,
  computeMonthlyWages,
  monthOf,
  payrollExternalId,
  previousMonth,
  type CrmWorker,
  type CrmWorkerShift,
} from "@/lib/tazrim/payroll";

const STAGE_LABELS: Record<string, string> = {
  material_ordered: "חומר הוזמן",
  approved: "חומר הגיע למפעל",
  production: "בייצור",
  install: "בהתקנה",
  done: "הושלם",
};

const STAGE_FORECAST_DAYS: Record<string, number> = {
  material_ordered: 60,
  approved: 30,
  production: 21,
  install: 14,
};

const TRACKED_STAGES = Object.keys(STAGE_FORECAST_DAYS).concat("done");

type DealPayment = { id: string; deal_id: string; amount: number; paid_at: string };

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type SyncRow = {
  company_id: string;
  type: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  cleared_date: string | null;
  source: string;
  external_source: string;
  external_id: string;
  notes: string;
};

// CRM data (deals, workers, shifts) now lives in the same database as Tazrim.
// RLS on those tables is not tuned for this screen, so reads use the service
// role. That is safe only because requireTazrimActionContext() has already
// proven the caller is owner/admin of the Pashkovsky company, and every query
// below is filtered by that company id.
function createCrmServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function syncAluminCRM() {
  const { supabase, companyId: tazrimCompanyId } = await requireTazrimActionContext();
  const crm = createCrmServiceClient();

  const { data: deals, error } = await crm
    .from("deals")
    .select("id, customer_name, price, stage, currency, deal_date")
    .eq("company_id", tazrimCompanyId)
    .not("price", "is", null)
    .gt("price", 0)
    .in("stage", TRACKED_STAGES);

  if (error || !deals) {
    throw new Error(`Не удалось прочитать сделки из AluminCRM: ${error?.message ?? "нет данных"}`);
  }

  const dealIds = deals.map((d) => d.id);

  const { data: payments, error: paymentsError } = await crm
    .from("deal_payments")
    .select("id, deal_id, amount, paid_at")
    .in("deal_id", dealIds);

  if (paymentsError) {
    throw new Error(`Не удалось прочитать deal_payments из AluminCRM: ${paymentsError.message}`);
  }

  const paymentsByDeal = new Map<string, DealPayment[]>();
  for (const p of (payments ?? []) as DealPayment[]) {
    const list = paymentsByDeal.get(p.deal_id) ?? [];
    list.push(p);
    paymentsByDeal.set(p.deal_id, list);
  }

  const doneDealIds = deals
    .filter((d) => d.stage === "done" && !paymentsByDeal.has(d.id as string))
    .map((d) => d.id);

  const doneDates = new Map<string, string>();
  if (doneDealIds.length > 0) {
    const { data: logs, error: logsError } = await crm
      .from("audit_logs")
      .select("resource_id, created_at, changes")
      .eq("resource_type", "deal")
      .in("resource_id", doneDealIds)
      .order("created_at", { ascending: false });

    if (logsError) {
      throw new Error(`Не удалось прочитать audit_logs из AluminCRM: ${logsError.message}`);
    }

    for (const log of logs ?? []) {
      const changes = log.changes as Record<string, unknown> | null;
      if (changes?.stage === "done" && !doneDates.has(log.resource_id as string)) {
        doneDates.set(log.resource_id as string, (log.created_at as string).slice(0, 10));
      }
    }
  }

  const today = new Date();
  const todayDateStr = todayStr();
  const rows: SyncRow[] = [];

  for (const deal of deals) {
    const stageLabel = STAGE_LABELS[deal.stage ?? ""] ?? deal.stage ?? "—";
    const dealPayments = paymentsByDeal.get(deal.id as string);

    if (dealPayments && dealPayments.length > 0) {
      dealPayments.forEach((payment, idx) => {
        const paidDate = payment.paid_at.slice(0, 10);
        const isPast = paidDate <= todayDateStr;
        rows.push({
          company_id: tazrimCompanyId,
          type: "income",
          amount: payment.amount,
          currency: deal.currency ?? "ILS",
          due_date: paidDate,
          status: isPast ? "cleared" : "planned",
          cleared_date: isPast ? paidDate : null,
          source: isPast ? "alumincrm" : "alumincrm_forecast",
          external_source: "alumincrm",
          external_id: payment.id,
          notes: `${deal.customer_name ?? "לקוח"} · תשלום ${idx + 1}/${dealPayments.length} · ${stageLabel}`,
        });
      });
      continue;
    }

    const isDone = deal.stage === "done";
    const due_date = isDone
      ? doneDates.get(deal.id as string) ?? (deal.deal_date ? new Date(deal.deal_date).toISOString().slice(0, 10) : todayDateStr)
      : addDays(today, STAGE_FORECAST_DAYS[deal.stage as string] ?? 30);

    rows.push({
      company_id: tazrimCompanyId,
      type: "income",
      amount: deal.price as number,
      currency: deal.currency ?? "ILS",
      due_date,
      status: isDone ? "cleared" : "planned",
      cleared_date: isDone ? due_date : null,
      source: isDone ? "alumincrm" : "alumincrm_forecast",
      external_source: "alumincrm",
      external_id: deal.id as string,
      notes: `${deal.customer_name ?? "לקוח"} · ${stageLabel}`,
    });
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("tz_cash_events")
      .upsert(rows, { onConflict: "company_id,external_source,external_id" });
    if (upsertError) {
      throw new Error(`Не удалось записать доходы в Tazrim: ${upsertError.message}`);
    }
  }

  const payrollRows = await buildPayrollRows(crm, supabase, tazrimCompanyId);

  if (payrollRows.length > 0) {
    const { error: payrollError } = await supabase
      .from("tz_cash_events")
      .upsert(payrollRows, { onConflict: "company_id,external_source,external_id" });
    if (payrollError) {
      throw new Error(`Не удалось записать зарплаты в Tazrim: ${payrollError.message}`);
    }
  }

  const currentIds = [...rows, ...payrollRows]
    .filter((r) => r.status === "planned")
    .map((r) => r.external_id);
  // Only auto-generated sources are cleaned up: hand-corrected payroll rows
  // (alumincrm_payroll_approved) must survive every sync.
  const { error: cleanupError } = await supabase
    .from("tz_cash_events")
    .delete()
    .eq("company_id", tazrimCompanyId)
    .eq("external_source", "alumincrm")
    .eq("status", "planned")
    .in("source", ["alumincrm_forecast", PAYROLL_SOURCE])
    .not("external_id", "in", `(${currentIds.length > 0 ? currentIds.map((id) => `"${id}"`).join(",") : "''"})`);

  if (cleanupError) {
    throw new Error(`Не удалось очистить устаревшие прогнозы: ${cleanupError.message}`);
  }

  await supabase.from("tz_integrations").upsert(
    {
      company_id: tazrimCompanyId,
      provider: "alumincrm",
      status: "connected",
      last_synced_at: new Date().toISOString(),
      config: {
        synced_rows: rows.length,
        deals_count: deals.length,
        payments_count: payments?.length ?? 0,
        payroll_rows: payrollRows.length,
      },
    },
    { onConflict: "company_id,provider" }
  );

  revalidateCashViews();
}

function revalidateCashViews() {
  revalidatePath("/app/admin/tazrim/crm");
  revalidatePath("/app/admin/tazrim");
  revalidatePath("/app/admin/tazrim/weekly");
  revalidatePath("/app/admin/tazrim/monthly");
}


interface PayrollRow {
  company_id: string;
  type: "expense";
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  cleared_date: string | null;
  source: string;
  external_source: string;
  external_id: string;
  payment_method: string;
  category_id: string | null;
  notes: string;
}

// Worker wages from AluminCRM shifts: one expense per worker per month, due on
// the 10th of the following month. Covers last month (payday this month) and
// the current month (forecast from the shifts logged so far). Rows already
// corrected by hand (approved) are skipped so the sync never overwrites them.
async function buildPayrollRows(
  crm: SupabaseClient,
  supabase: TazrimSupabase,
  tazrimCompanyId: string
): Promise<PayrollRow[]> {
  const today = todayInIsrael();
  const currentMonth = monthOf(today);
  const firstMonth = previousMonth(today);

  const [workersResult, shiftsResult, approvedResult, categoryResult] =
    await Promise.all([
      crm
        .from("workers")
        .select("id, first_name, last_name, daily_rate, hourly_rate")
        .eq("company_id", tazrimCompanyId),
      crm
        .from("worker_shifts")
        .select("worker_id, shift_date, shift_type, minutes_worked, computed_cost")
        .eq("company_id", tazrimCompanyId)
        .gte("shift_date", `${firstMonth}-01`),
      supabase
        .from("tz_cash_events")
        .select("external_id")
        .eq("company_id", tazrimCompanyId)
        .eq("external_source", "alumincrm")
        .eq("source", PAYROLL_APPROVED_SOURCE),
      supabase
        .from("tz_expense_categories")
        .select("id")
        .eq("company_id", tazrimCompanyId)
        .eq("name", PAYROLL_CATEGORY)
        .maybeSingle(),
    ]);

  if (workersResult.error) {
    throw new Error(`Не удалось прочитать workers из AluminCRM: ${workersResult.error.message}`);
  }
  if (shiftsResult.error) {
    throw new Error(`Не удалось прочитать worker_shifts из AluminCRM: ${shiftsResult.error.message}`);
  }
  if (approvedResult.error) {
    throw new Error(`Не удалось прочитать утверждённые зарплаты: ${approvedResult.error.message}`);
  }

  const approvedIds = new Set(
    (approvedResult.data ?? []).map((r) => r.external_id)
  );

  return computeMonthlyWages(
    (workersResult.data ?? []) as CrmWorker[],
    (shiftsResult.data ?? []) as CrmWorkerShift[]
  )
    .filter((w) => w.month >= firstMonth && w.month <= currentMonth)
    .map((w): PayrollRow => {
      const isPaid = w.payDate <= today;
      return {
        company_id: tazrimCompanyId,
        type: "expense",
        amount: w.amount,
        currency: "ILS",
        due_date: w.payDate,
        status: isPaid ? "cleared" : "planned",
        cleared_date: isPaid ? w.payDate : null,
        source: PAYROLL_SOURCE,
        external_source: "alumincrm",
        external_id: payrollExternalId(w.workerId, w.month),
        payment_method: "bank_transfer",
        category_id: categoryResult.data?.id ?? null,
        notes: `${w.workerName} · שכר ${w.month.slice(5, 7)}/${w.month.slice(0, 4)}`,
      };
    })
    .filter((r) => !approvedIds.has(r.external_id));
}

// Accountant-approved correction of a payroll expense. The amount is set by
// hand and the row is re-labelled so later syncs leave it alone.
export async function approvePayrollExpense(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const amount = Number(String(formData.get("amount") ?? "").trim());

  if (!id) throw new Error("Не передан id строки зарплаты");
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Сумма зарплаты должна быть числом не меньше 0");
  }

  const { supabase, companyId: company_id } = await requireTazrimActionContext();

  const { data, error } = await supabase
    .from("tz_cash_events")
    .update({ amount, source: PAYROLL_APPROVED_SOURCE })
    .eq("id", id)
    .eq("company_id", company_id)
    .in("source", PAYROLL_SOURCES)
    .select("id");

  if (error) throw new Error(`Не удалось сохранить зарплату: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error("Строка зарплаты не найдена или нет прав на изменение (RLS)");
  }

  revalidateCashViews();
}
