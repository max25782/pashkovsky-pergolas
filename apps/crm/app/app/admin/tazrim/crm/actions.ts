"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireTazrimActionContext, type TazrimSupabase } from "@/lib/tazrim/guard";
import { todayInIsrael } from "@/lib/tazrim/format";
import {
  CRM_EXTERNAL_SOURCE,
  CRM_REVERSE_AUDIT_ACTION,
  CRM_SYNC_AUDIT_SOURCE,
  NO_ACCOUNT,
  REVERSED_STATUS,
  buildPaymentRow,
  findVanishedPayments,
  type AccountFields,
  type SyncedPaymentRow,
} from "@/lib/tazrim/crm-payments";
import { loadCompanyVatPercent } from "@/lib/deals/company-vat";
import { laborByDeal, loadCompanyShifts, loadWorkerCostBook } from "@/lib/workers/load-cost-book";
import { buildMonthPensionReport } from "@/lib/workers/pension-report";
import {
  CALCULATED_SOURCES,
  buildPensionRows,
  buildVatRows,
  type CalculatedCashRow,
  type VatDealInput,
} from "@/lib/tazrim/vat-pension-rows";
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

// Every row of the income upsert carries the account columns so the bulk
// upsert has one uniform shape (deal-level rows use NO_ACCOUNT).
type SyncRow = AccountFields & {
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
  const {
    supabase,
    companyId: tazrimCompanyId,
    userId,
  } = await requireTazrimActionContext();
  const crm = createCrmServiceClient();

  // CRM payments carry no account, so they land on the company default account.
  // No default (or a non-ILS payment) -> needs_account, outside every balance.
  const { data: defaultAccount, error: defaultAccountError } = await supabase
    .from("tz_bank_accounts")
    .select("id")
    .eq("company_id", tazrimCompanyId)
    .eq("is_crm_default", true)
    .maybeSingle();

  if (defaultAccountError) {
    throw new Error(
      `Не удалось прочитать счёт по умолчанию (применена ли миграция 059_tz_cash_events_crm_balance?): ${defaultAccountError.message}`
    );
  }
  const defaultAccountId: string | null = defaultAccount?.id ?? null;

  const { data: deals, error } = await crm
    .from("deals")
    .select("id, customer_name, price, my_cost, stage, currency, deal_date")
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
  // Date each payment-less deal is placed on in Tazrim; its VAT follows it.
  const fallbackDates = new Map<string, string>();

  for (const deal of deals) {
    const stageLabel = STAGE_LABELS[deal.stage ?? ""] ?? deal.stage ?? "—";
    const dealPayments = paymentsByDeal.get(deal.id as string);

    if (dealPayments && dealPayments.length > 0) {
      dealPayments.forEach((payment, idx) => {
        rows.push(
          buildPaymentRow({
            companyId: tazrimCompanyId,
            deal: {
              id: deal.id as string,
              customer_name: deal.customer_name,
              currency: deal.currency,
            },
            payment,
            index: idx,
            total: dealPayments.length,
            stageLabel,
            today: todayDateStr,
            defaultAccountId,
          })
        );
      });
      continue;
    }

    const isDone = deal.stage === "done";
    const due_date = isDone
      ? doneDates.get(deal.id as string) ?? (deal.deal_date ? new Date(deal.deal_date).toISOString().slice(0, 10) : todayDateStr)
      : addDays(today, STAGE_FORECAST_DAYS[deal.stage as string] ?? 30);

    fallbackDates.set(deal.id as string, due_date);
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
      ...NO_ACCOUNT,
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

  const calculatedRows = await buildCalculatedRows(
    crm,
    tazrimCompanyId,
    deals,
    paymentsByDeal,
    fallbackDates,
  );

  if (calculatedRows.length > 0) {
    const { error: calculatedError } = await supabase
      .from("tz_cash_events")
      .upsert(calculatedRows, { onConflict: "company_id,external_source,external_id" });
    if (calculatedError) {
      throw new Error(`Не удалось записать НДС и пенсию в Tazrim: ${calculatedError.message}`);
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

  // Calculated VAT / pension rows that no longer apply (a payment was removed,
  // a worker flagged "no pension"). Only planned rows from this month on are
  // touched: earlier months are history and manual rows have other sources.
  const calculatedIds = calculatedRows.map((r) => r.external_id);
  const { error: calculatedCleanupError } = await supabase
    .from("tz_cash_events")
    .delete()
    .eq("company_id", tazrimCompanyId)
    .eq("external_source", "alumincrm")
    .eq("status", "planned")
    .in("source", CALCULATED_SOURCES)
    .gte("due_date", `${monthOf(todayInIsrael())}-01`)
    .not("external_id", "in", `(${calculatedIds.length > 0 ? calculatedIds.map((id) => `"${id}"`).join(",") : "''"})`);

  if (calculatedCleanupError) {
    throw new Error(`Не удалось очистить устаревший НДС и пенсию: ${calculatedCleanupError.message}`);
  }

  const reversedPayments = await reverseVanishedPayments(
    crm,
    supabase,
    tazrimCompanyId,
    userId
  );

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
        calculated_rows: calculatedRows.length,
        reversed_payments: reversedPayments,
        payments_needing_account: rows.filter((r) => r.needs_account).length,
        crm_default_account_id: defaultAccountId,
      },
    },
    { onConflict: "company_id,provider" }
  );

  revalidateCashViews();
}

function revalidateCashViews() {
  revalidatePath("/app/admin/tazrim/crm");
  revalidatePath("/app/admin/tazrim/balance");
  revalidatePath("/app/admin/tazrim");
  revalidatePath("/app/admin/tazrim/weekly");
  revalidatePath("/app/admin/tazrim/monthly");
}


const SYNCED_PAGE_SIZE = 1000;
const CRM_LOOKUP_CHUNK = 100;

// The CRM deletes payments for real, so a cleared payment that was synced
// earlier and is gone from deal_payments must stop counting. History is kept:
// the row becomes status 'reversed' and a tz_audit_log entry (source crm_sync)
// records the old and new values. Idempotent: reversed rows are no longer
// 'cleared', so a repeat run finds nothing to do.
async function reverseVanishedPayments(
  crm: SupabaseClient,
  supabase: TazrimSupabase,
  tazrimCompanyId: string,
  userId: string
): Promise<number> {
  const synced: (SyncedPaymentRow & {
    amount: number;
    due_date: string;
    cleared_date: string | null;
    currency: string;
    bank_account_id: string | null;
  })[] = [];

  for (let from = 0; ; from += SYNCED_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("tz_cash_events")
      .select(
        "id, crm_payment_id, status, amount, due_date, cleared_date, currency, bank_account_id"
      )
      .eq("company_id", tazrimCompanyId)
      .eq("external_source", CRM_EXTERNAL_SOURCE)
      .eq("status", "cleared")
      .not("crm_payment_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + SYNCED_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Не удалось прочитать синхронизированные платежи: ${error.message}`);
    }
    synced.push(...(data ?? []));
    if ((data ?? []).length < SYNCED_PAGE_SIZE) break;
  }

  if (synced.length === 0) return 0;

  // Ask the CRM about exactly these payment ids. Looking only at the tracked
  // deals would mistake a deal that left the tracked stages for deleted payments.
  const stillInCrm = new Set<string>();
  const ids = synced.map((r) => r.crm_payment_id as string);
  for (let i = 0; i < ids.length; i += CRM_LOOKUP_CHUNK) {
    const { data, error } = await crm
      .from("deal_payments")
      .select("id")
      .eq("company_id", tazrimCompanyId)
      .in("id", ids.slice(i, i + CRM_LOOKUP_CHUNK));

    if (error) {
      throw new Error(`Не удалось проверить платежи в AluminCRM: ${error.message}`);
    }
    for (const row of data ?? []) stillInCrm.add(row.id as string);
  }

  const vanished = findVanishedPayments(synced, stillInCrm);
  if (vanished.length === 0) return 0;

  // Audit first: if this insert fails nothing was reversed yet and the next
  // sync simply retries; the reverse is never applied without a log entry.
  const { error: auditError } = await supabase.from("tz_audit_log").insert(
    vanished.map((row) => ({
      company_id: tazrimCompanyId,
      table_name: "tz_cash_events",
      record_id: row.id,
      action: CRM_REVERSE_AUDIT_ACTION,
      changed_by: userId,
      old_data: {
        status: row.status,
        amount: row.amount,
        due_date: row.due_date,
        cleared_date: row.cleared_date,
        currency: row.currency,
        bank_account_id: row.bank_account_id,
        crm_payment_id: row.crm_payment_id,
      },
      new_data: {
        status: REVERSED_STATUS,
        source: CRM_SYNC_AUDIT_SOURCE,
        reason: "payment no longer exists in AluminCRM",
      },
    }))
  );
  if (auditError) {
    throw new Error(`Не удалось записать tz_audit_log: ${auditError.message}`);
  }

  const { data: updated, error: reverseError } = await supabase
    .from("tz_cash_events")
    .update({ status: REVERSED_STATUS })
    .eq("company_id", tazrimCompanyId)
    .eq("status", "cleared")
    .in(
      "id",
      vanished.map((r) => r.id)
    )
    .select("id");

  if (reverseError) {
    throw new Error(`Не удалось сторнировать платежи: ${reverseError.message}`);
  }
  return updated?.length ?? 0;
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

// VAT payable and the employer's pension / pitzuim, calculated from CRM data
// and placed in Tazrim as separate, clearly marked rows. Manual taxes and
// payments are never read or changed here.
async function buildCalculatedRows(
  crm: SupabaseClient,
  tazrimCompanyId: string,
  deals: Array<{ id: unknown; price: unknown; my_cost: unknown }>,
  paymentsByDeal: Map<string, DealPayment[]>,
  fallbackDates: Map<string, string>,
): Promise<CalculatedCashRow[]> {
  const today = todayInIsrael();
  const currentMonth = monthOf(today);

  const [vatPercent, book, shifts] = await Promise.all([
    loadCompanyVatPercent(crm, tazrimCompanyId),
    loadWorkerCostBook(crm, tazrimCompanyId),
    loadCompanyShifts(crm, tazrimCompanyId),
  ]);
  const labor = laborByDeal(shifts, book);

  const vatDeals: VatDealInput[] = deals.map((deal) => {
    const id = deal.id as string;
    return {
      id,
      price: deal.price as number,
      my_cost: deal.my_cost as number | string | null,
      labor: labor[id] ?? 0,
      payments: (paymentsByDeal.get(id) ?? []).map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paid_at: p.paid_at,
      })),
      fallbackDate: fallbackDates.get(id) ?? today,
    };
  });

  const vatRows = buildVatRows({
    companyId: tazrimCompanyId,
    today,
    vatPercent,
    deals: vatDeals,
  });

  // Last month (paid this month) and the current month so far (forecast).
  const pensionMonths = [previousMonth(today), currentMonth];
  const pensionRows = buildPensionRows({
    companyId: tazrimCompanyId,
    today,
    reports: pensionMonths.map((month) => buildMonthPensionReport(shifts, book, month)),
  });

  return [...vatRows, ...pensionRows];
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
