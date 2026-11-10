import {
  computeAccountBalance,
  type BalanceEvent,
  type BalanceSnapshot,
} from "@/lib/tazrim/account-balance";
import { buildPlannedFlows, projectBalance } from "@/lib/tazrim/cash-flow";
import type { EventRow } from "@/lib/tazrim/cash-flow";

const ACCOUNT = "acc-1";

function snapshot(
  snapshot_at: string,
  balance = 1000,
  bank_account_id = ACCOUNT
): BalanceSnapshot {
  return { bank_account_id, balance, snapshot_at };
}

function payment(overrides: Partial<BalanceEvent> = {}): BalanceEvent {
  return {
    bank_account_id: ACCOUNT,
    type: "income",
    source: "alumincrm",
    status: "cleared",
    currency: "ILS",
    amount: 200,
    cleared_date: "2026-11-05",
    needs_account: false,
    ...overrides,
  };
}

// Noon UTC is the same calendar day in Israel (UTC+2 / +3).
const SNAP_NOV_3 = snapshot("2026-11-03T12:00:00Z");

describe("computeAccountBalance", () => {
  it("has no balance without a snapshot, whatever the payments", () => {
    const result = computeAccountBalance(null, [payment()]);
    expect(result.balance).toBeNull();
    expect(result.crmCount).toBe(0);
  });

  it("is just the snapshot when there are no payments", () => {
    const result = computeAccountBalance(SNAP_NOV_3, []);
    expect(result).toMatchObject({
      balance: 1000,
      snapshotBalance: 1000,
      snapshotDate: "2026-11-03",
      crmTotal: 0,
      crmCount: 0,
    });
  });

  it("ignores a payment cleared before the snapshot date", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ cleared_date: "2026-11-02" }),
    ]);
    expect(result.balance).toBe(1000);
    expect(result.crmCount).toBe(0);
  });

  it("ignores a payment cleared on the snapshot day (already in the typed figure)", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ cleared_date: "2026-11-03" }),
    ]);
    expect(result.balance).toBe(1000);
  });

  it("counts a payment cleared after the snapshot date", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ cleared_date: "2026-11-04", amount: 200 }),
      payment({ cleared_date: "2026-11-06", amount: 300 }),
    ]);
    expect(result).toMatchObject({
      balance: 1500,
      crmTotal: 500,
      crmCount: 2,
    });
  });

  it("uses the Israel calendar day of the snapshot, not the UTC day", () => {
    // 22:30 UTC on Nov 6 is 00:30 on Nov 7 in Israel (UTC+2).
    const lateSnapshot = snapshot("2026-11-06T22:30:00Z");
    expect(
      computeAccountBalance(lateSnapshot, [payment({ cleared_date: "2026-11-07" })])
        .balance
    ).toBe(1000);
    expect(
      computeAccountBalance(lateSnapshot, [payment({ cleared_date: "2026-11-08" })])
        .balance
    ).toBe(1200);
  });

  it("follows an amount edited in the CRM", () => {
    const before = computeAccountBalance(SNAP_NOV_3, [
      payment({ cleared_date: "2026-11-05", amount: 200 }),
    ]);
    const after = computeAccountBalance(SNAP_NOV_3, [
      payment({ cleared_date: "2026-11-05", amount: 350 }),
    ]);
    expect(before.balance).toBe(1200);
    expect(after.balance).toBe(1350);
  });

  it("drops a reversed payment from the balance", () => {
    const live = payment({ amount: 200 });
    const reversed = payment({ amount: 200, status: "reversed" });
    expect(computeAccountBalance(SNAP_NOV_3, [live]).balance).toBe(1200);
    expect(computeAccountBalance(SNAP_NOV_3, [reversed]).balance).toBe(1000);
  });

  it("ignores payments that are not in ILS", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ currency: "USD", amount: 999 }),
      payment({ currency: null, amount: 111 }),
    ]);
    expect(result.balance).toBe(1000);
  });

  it("accepts ILS regardless of letter case", () => {
    expect(
      computeAccountBalance(SNAP_NOV_3, [payment({ currency: "ils" })]).balance
    ).toBe(1200);
  });

  it("ignores payments flagged needs_account or without an account", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ needs_account: true, bank_account_id: ACCOUNT }),
      payment({ bank_account_id: null, needs_account: true }),
      payment({ bank_account_id: null }),
    ]);
    expect(result.balance).toBe(1000);
  });

  it("ignores payments linked to another account", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ bank_account_id: "acc-2" }),
    ]);
    expect(result.balance).toBe(1000);
  });

  it("ignores planned, non-CRM and expense rows", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ status: "planned", cleared_date: null }),
      payment({ source: "manual" }),
      payment({ source: "alumincrm_forecast" }),
      payment({ type: "expense" }),
      payment({ cleared_date: null }),
    ]);
    expect(result.balance).toBe(1000);
  });

  it("lets a newer manual snapshot reset the calculation", () => {
    const events = [payment({ cleared_date: "2026-11-05", amount: 200 })];
    expect(computeAccountBalance(SNAP_NOV_3, events).balance).toBe(1200);

    const newer = snapshot("2026-11-06T12:00:00Z", 5000);
    const result = computeAccountBalance(newer, events);
    expect(result.balance).toBe(5000);
    expect(result.crmCount).toBe(0);
  });

  it("keeps cents exact", () => {
    const result = computeAccountBalance(SNAP_NOV_3, [
      payment({ amount: 0.1 }),
      payment({ amount: 0.2 }),
    ]);
    expect(result.crmTotal).toBe(0.3);
    expect(result.balance).toBe(1000.3);
  });

  it("accepts string amounts from the database", () => {
    const result = computeAccountBalance(snapshot("2026-11-03T12:00:00Z", "1000.50" as unknown as number), [
      payment({ amount: "199.50" }),
    ]);
    expect(result.balance).toBe(1200);
  });
});

describe("cash picture does not count a CRM payment twice", () => {
  function eventRow(overrides: Partial<EventRow>): EventRow {
    return {
      id: "e1",
      type: "income",
      amount: 200,
      due_date: "2026-11-08",
      status: "planned",
      notes: null,
      payment_method: null,
      recurring_rule_id: null,
      debt_id: null,
      vendors: null,
      checks: null,
      ...overrides,
    };
  }

  const today = "2026-11-07";
  const weekEnd = "2026-11-09";
  const window = { from: today, to: weekEnd };

  it("projects a planned payment from the balance only once it is planned", () => {
    const balance = computeAccountBalance(SNAP_NOV_3, []).balance ?? 0;
    const flows = buildPlannedFlows(
      [eventRow({ status: "planned" })],
      [],
      window
    );
    const days = projectBalance(balance, flows, today, weekEnd);
    expect(days.at(-1)?.balance).toBe(1200);
  });

  it("once cleared, the payment is in the balance and out of the projection", () => {
    const cleared = payment({ cleared_date: "2026-11-05", amount: 200 });
    const balance = computeAccountBalance(SNAP_NOV_3, [cleared]).balance ?? 0;
    const flows = buildPlannedFlows(
      [eventRow({ status: "cleared", due_date: "2026-11-08" })],
      [],
      window
    );
    expect(flows).toHaveLength(0);
    const days = projectBalance(balance, flows, today, weekEnd);
    expect(days.at(-1)?.balance).toBe(1200);
  });

  it("end balance is the same before and after a planned payment clears", () => {
    const planned = projectBalance(
      computeAccountBalance(SNAP_NOV_3, []).balance ?? 0,
      buildPlannedFlows([eventRow({ status: "planned" })], [], window),
      today,
      weekEnd
    ).at(-1)?.balance;

    const clearedBalance =
      computeAccountBalance(SNAP_NOV_3, [payment({ cleared_date: "2026-11-07" })])
        .balance ?? 0;
    const cleared = projectBalance(
      clearedBalance,
      buildPlannedFlows([eventRow({ status: "cleared" })], [], window),
      today,
      weekEnd
    ).at(-1)?.balance;

    expect(planned).toBe(1200);
    expect(cleared).toBe(1200);
  });
});
