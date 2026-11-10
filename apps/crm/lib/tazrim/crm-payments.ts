import { BALANCE_CURRENCY, CRM_INCOME_SOURCE } from "@/lib/tazrim/account-balance";

// Pure planning helpers for syncAluminCRM, kept free of Supabase so they can be
// unit-tested: how a CRM payment becomes a tz_cash_events row, and which already
// synced payments have disappeared from the CRM.

export const CRM_EXTERNAL_SOURCE = "alumincrm";
export const CRM_FORECAST_SOURCE = "alumincrm_forecast";
export const REVERSED_STATUS = "reversed";
// audit_log.new_data.source / audit_log.action for reversals done by the sync.
export const CRM_SYNC_AUDIT_SOURCE = "crm_sync";
export const CRM_REVERSE_AUDIT_ACTION = "crm_sync_reverse";

export interface CrmPaymentDeal {
  id: string;
  customer_name: string | null;
  currency: string | null;
}

export interface CrmPayment {
  id: string;
  deal_id: string;
  amount: number;
  paid_at: string;
}

// Account-related columns on a tz_cash_events row. Rows that are not CRM payments
// (deal-level forecasts, payroll) carry NO_ACCOUNT so a bulk upsert never
// mixes shapes and never touches the balance.
export interface AccountFields {
  bank_account_id: string | null;
  crm_payment_id: string | null;
  needs_account: boolean;
}

export const NO_ACCOUNT: AccountFields = {
  bank_account_id: null,
  crm_payment_id: null,
  needs_account: false,
};

export interface PaymentIncomeRow extends AccountFields {
  company_id: string;
  type: "income";
  amount: number;
  currency: string;
  due_date: string;
  status: "cleared" | "planned";
  cleared_date: string | null;
  source: string;
  external_source: string;
  external_id: string;
  notes: string;
}

export function isBalanceCurrency(currency: string | null | undefined): boolean {
  return (currency ?? BALANCE_CURRENCY).trim().toUpperCase() === BALANCE_CURRENCY;
}

// Which account a CRM payment lands on. CRM payments carry no account, so it is
// the company default; without one (or in a foreign currency) the row is
// flagged and stays out of every balance until someone decides.
export function resolvePaymentAccount(
  currency: string | null | undefined,
  defaultAccountId: string | null
): Pick<AccountFields, "bank_account_id" | "needs_account"> {
  if (!isBalanceCurrency(currency) || defaultAccountId === null) {
    return { bank_account_id: null, needs_account: true };
  }
  return { bank_account_id: defaultAccountId, needs_account: false };
}

export interface BuildPaymentRowInput {
  companyId: string;
  deal: CrmPaymentDeal;
  payment: CrmPayment;
  index: number;
  total: number;
  stageLabel: string;
  today: string;
  defaultAccountId: string | null;
}

// One CRM payment -> one tz_cash_events income row. The upsert key
// (company_id, external_source, external_id = payment id) makes a repeated
// sync update the same row instead of adding a second one; an amount edited in
// the CRM flows through the same upsert.
export function buildPaymentRow(input: BuildPaymentRowInput): PaymentIncomeRow {
  const { companyId, deal, payment, index, total, stageLabel, today } = input;
  const paidDate = payment.paid_at.slice(0, 10);
  const isPast = paidDate <= today;
  const currency = deal.currency ?? BALANCE_CURRENCY;

  return {
    company_id: companyId,
    type: "income",
    amount: payment.amount,
    currency,
    due_date: paidDate,
    status: isPast ? "cleared" : "planned",
    cleared_date: isPast ? paidDate : null,
    source: isPast ? CRM_INCOME_SOURCE : CRM_FORECAST_SOURCE,
    external_source: CRM_EXTERNAL_SOURCE,
    external_id: payment.id,
    notes: `${deal.customer_name ?? "לקוח"} · תשלום ${index + 1}/${total} · ${stageLabel}`,
    crm_payment_id: payment.id,
    ...resolvePaymentAccount(currency, input.defaultAccountId),
  };
}

export interface SyncedPaymentRow {
  id: string;
  crm_payment_id: string | null;
  status: string;
}

// Already-synced cleared payments whose CRM payment no longer exists (the CRM
// deletes payments for real). `idsStillInCrm` must come from asking the CRM for
// exactly these ids, not from the tracked-deal list: a deal leaving the tracked
// stages must not look like a deleted payment.
export function findVanishedPayments<T extends SyncedPaymentRow>(
  synced: T[],
  idsStillInCrm: ReadonlySet<string>
): T[] {
  return synced.filter(
    (row) =>
      row.status === "cleared" &&
      row.crm_payment_id !== null &&
      !idsStillInCrm.has(row.crm_payment_id)
  );
}
