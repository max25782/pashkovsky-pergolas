import {
  computeAccountBalance,
  type BalanceEvent,
  type BalanceSnapshot,
} from "@/lib/tazrim/account-balance";
import {
  buildPaymentRow,
  findVanishedPayments,
  resolvePaymentAccount,
  type CrmPayment,
  type CrmPaymentDeal,
  type PaymentIncomeRow,
} from "@/lib/tazrim/crm-payments";

const COMPANY = "company-1";
const ACCOUNT = "acc-1";
const TODAY = "2026-11-07";

const SNAPSHOT: BalanceSnapshot = {
  bank_account_id: ACCOUNT,
  balance: 1000,
  snapshot_at: "2026-11-03T12:00:00Z",
};

const DEAL: CrmPaymentDeal = { id: "deal-1", customer_name: "Cohen", currency: "ILS" };

function crmPayment(id: string, amount: number, paid_at = "2026-11-05T09:00:00Z"): CrmPayment {
  return { id, deal_id: DEAL.id, amount, paid_at };
}

// A tiny in-memory stand-in for the two sync steps that touch the database:
// upsert on (company_id, external_source, external_id) and reversal of rows
// whose CRM payment is gone. All decisions come from the real pure helpers.
class FakeTazrim {
  rows = new Map<string, Omit<PaymentIncomeRow, "status"> & { status: string }>();

  upsert(rows: PaymentIncomeRow[]) {
    for (const row of rows) {
      this.rows.set(`${row.company_id}|${row.external_source}|${row.external_id}`, { ...row });
    }
  }

  reverseMissing(idsStillInCrm: Set<string>) {
    const synced = [...this.rows.values()].map((r) => ({
      id: r.external_id,
      crm_payment_id: r.crm_payment_id,
      status: r.status,
    }));
    const vanished = findVanishedPayments(synced, idsStillInCrm);
    for (const v of vanished) {
      const row = [...this.rows.values()].find((r) => r.external_id === v.id);
      if (row) row.status = "reversed";
    }
    return vanished.length;
  }

  balance(snapshot: BalanceSnapshot = SNAPSHOT) {
    const events: BalanceEvent[] = [...this.rows.values()];
    return computeAccountBalance(snapshot, events);
  }
}

// One sync pass over the given CRM payments.
function sync(
  store: FakeTazrim,
  payments: CrmPayment[],
  defaultAccountId: string | null,
  deal: CrmPaymentDeal = DEAL
) {
  store.upsert(
    payments.map((payment, index) =>
      buildPaymentRow({
        companyId: COMPANY,
        deal,
        payment,
        index,
        total: payments.length,
        stageLabel: "בייצור",
        today: TODAY,
        defaultAccountId,
      })
    )
  );
  // The CRM is asked about the already-synced ids; what it still has is `payments`.
  return store.reverseMissing(new Set(payments.map((p) => p.id)));
}

describe("resolvePaymentAccount", () => {
  it("uses the default account for an ILS payment", () => {
    expect(resolvePaymentAccount("ILS", ACCOUNT)).toEqual({
      bank_account_id: ACCOUNT,
      needs_account: false,
    });
  });

  it("flags the payment when there is no default account", () => {
    expect(resolvePaymentAccount("ILS", null)).toEqual({
      bank_account_id: null,
      needs_account: true,
    });
  });

  it("flags a non-ILS payment even with a default account", () => {
    expect(resolvePaymentAccount("USD", ACCOUNT)).toEqual({
      bank_account_id: null,
      needs_account: true,
    });
  });

  it("treats a missing currency as ILS (the CRM default)", () => {
    expect(resolvePaymentAccount(null, ACCOUNT).bank_account_id).toBe(ACCOUNT);
  });
});

describe("buildPaymentRow", () => {
  it("clears a past payment on its account with the CRM id as key", () => {
    const row = buildPaymentRow({
      companyId: COMPANY,
      deal: DEAL,
      payment: crmPayment("pay-1", 200),
      index: 0,
      total: 1,
      stageLabel: "בייצור",
      today: TODAY,
      defaultAccountId: ACCOUNT,
    });
    expect(row).toMatchObject({
      type: "income",
      status: "cleared",
      cleared_date: "2026-11-05",
      source: "alumincrm",
      external_source: "alumincrm",
      external_id: "pay-1",
      crm_payment_id: "pay-1",
      bank_account_id: ACCOUNT,
      needs_account: false,
    });
  });

  it("keeps a future payment planned and out of the cleared source", () => {
    const row = buildPaymentRow({
      companyId: COMPANY,
      deal: DEAL,
      payment: crmPayment("pay-2", 200, "2026-12-01T09:00:00Z"),
      index: 0,
      total: 1,
      stageLabel: "בייצור",
      today: TODAY,
      defaultAccountId: ACCOUNT,
    });
    expect(row).toMatchObject({
      status: "planned",
      cleared_date: null,
      source: "alumincrm_forecast",
    });
  });
});

describe("syncing CRM payments into the balance", () => {
  it("does not grow the balance on a second identical sync", () => {
    const store = new FakeTazrim();
    const payments = [crmPayment("pay-1", 200), crmPayment("pay-2", 300, "2026-11-06T09:00:00Z")];

    sync(store, payments, ACCOUNT);
    const first = store.balance();
    sync(store, payments, ACCOUNT);
    sync(store, payments, ACCOUNT);
    const third = store.balance();

    expect(first.balance).toBe(1500);
    expect(third.balance).toBe(1500);
    expect(store.rows.size).toBe(2);
    expect(third.crmCount).toBe(2);
  });

  it("follows an amount edited in the CRM through the same upsert", () => {
    const store = new FakeTazrim();
    sync(store, [crmPayment("pay-1", 200)], ACCOUNT);
    expect(store.balance().balance).toBe(1200);

    sync(store, [crmPayment("pay-1", 450)], ACCOUNT);
    expect(store.balance().balance).toBe(1450);
    expect(store.rows.size).toBe(1);
  });

  it("reverses a payment deleted in the CRM and keeps the row as history", () => {
    const store = new FakeTazrim();
    sync(store, [crmPayment("pay-1", 200), crmPayment("pay-2", 300)], ACCOUNT);
    expect(store.balance().balance).toBe(1500);

    const reversed = sync(store, [crmPayment("pay-2", 300)], ACCOUNT);

    expect(reversed).toBe(1);
    expect(store.balance().balance).toBe(1300);
    expect(store.rows.size).toBe(2);
    expect(
      [...store.rows.values()].find((r) => r.external_id === "pay-1")?.status
    ).toBe("reversed");
  });

  it("reverses only once: a repeat sync finds nothing more to reverse", () => {
    const store = new FakeTazrim();
    sync(store, [crmPayment("pay-1", 200)], ACCOUNT);

    expect(sync(store, [], ACCOUNT)).toBe(1);
    expect(sync(store, [], ACCOUNT)).toBe(0);
    expect(store.balance().balance).toBe(1000);
  });

  it("does not reverse a payment the CRM still has", () => {
    const rows = [
      { id: "r1", crm_payment_id: "pay-1", status: "cleared" },
      { id: "r2", crm_payment_id: "pay-2", status: "cleared" },
    ];
    expect(findVanishedPayments(rows, new Set(["pay-1", "pay-2"]))).toEqual([]);
  });

  it("never reverses rows without a CRM payment id or not cleared", () => {
    const rows = [
      { id: "deal-row", crm_payment_id: null, status: "cleared" },
      { id: "planned", crm_payment_id: "pay-3", status: "planned" },
      { id: "already", crm_payment_id: "pay-4", status: "reversed" },
    ];
    expect(findVanishedPayments(rows, new Set())).toEqual([]);
  });

  it("keeps a payment out of the balance while no default account exists", () => {
    const store = new FakeTazrim();
    sync(store, [crmPayment("pay-1", 200)], null);

    const row = [...store.rows.values()][0];
    expect(row).toMatchObject({ bank_account_id: null, needs_account: true });
    expect(store.balance().balance).toBe(1000);
  });

  it("picks the payment up on the next sync once a default account is chosen", () => {
    const store = new FakeTazrim();
    sync(store, [crmPayment("pay-1", 200)], null);
    expect(store.balance().balance).toBe(1000);

    sync(store, [crmPayment("pay-1", 200)], ACCOUNT);
    expect(store.balance().balance).toBe(1200);
    expect(store.rows.size).toBe(1);
  });

  it("keeps a non-ILS payment out of the balance", () => {
    const store = new FakeTazrim();
    sync(store, [crmPayment("pay-1", 999)], ACCOUNT, { ...DEAL, currency: "USD" });

    const row = [...store.rows.values()][0];
    expect(row).toMatchObject({ needs_account: true, bank_account_id: null });
    expect(store.balance().balance).toBe(1000);
  });

  it("ignores a payment cleared before the snapshot even after sync", () => {
    const store = new FakeTazrim();
    sync(store, [crmPayment("pay-old", 700, "2026-10-20T09:00:00Z")], ACCOUNT);
    expect(store.balance().balance).toBe(1000);
  });
});
