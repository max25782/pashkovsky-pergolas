import {
  PENSION_SOURCE,
  VAT_SOURCE,
  buildPensionRows,
  buildVatRows,
  vatExternalId,
  type VatDealInput,
} from "../vat-pension-rows";
import { buildMonthPensionReport } from "@/lib/workers/pension-report";
import type { WorkerCostBook, WorkerShiftRow } from "@/lib/workers/load-cost-book";

const COMPANY = "company-1";
const TODAY = "2026-11-13";

function deal(overrides: Partial<VatDealInput> & { id: string }): VatDealInput {
  return {
    price: 118000,
    my_cost: 59000,
    labor: 10000,
    payments: [],
    fallbackDate: "2026-11-30",
    ...overrides,
  };
}

describe("buildVatRows", () => {
  it("puts the VAT of a month's money on the 15th of the next month", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 18,
      deals: [
        deal({
          id: "a",
          payments: [{ id: "p1", amount: 118000, paid_at: "2026-11-05T09:00:00Z" }],
        }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "expense",
      amount: 9000,
      due_date: "2026-12-15",
      status: "planned",
      cleared_date: null,
      source: VAT_SOURCE,
      external_source: "alumincrm",
      external_id: vatExternalId(COMPANY, "2026-12"),
    });
    expect(rows[0].notes).toContain("НДС к уплате");
    expect(rows[0].notes).toContain("расчётный");
  });

  it("splits a staged deal over the due months of its payments", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 18,
      deals: [
        deal({
          id: "a",
          payments: [
            { id: "p1", amount: 47200, paid_at: "2026-10-28T10:00:00Z" },
            { id: "p2", amount: 70800, paid_at: "2026-11-03T10:00:00Z" },
          ],
        }),
      ],
    });
    // October money is due on 15 Nov (still ahead on the 13th), November money on 15 Dec.
    expect(rows.map((r) => [r.due_date, r.amount])).toEqual([
      ["2026-11-15", 3600],
      ["2026-12-15", 5400],
    ]);
  });

  it("sums several deals of one month into a single row", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 18,
      deals: [
        deal({ id: "a", payments: [{ id: "p1", amount: 118000, paid_at: "2026-11-05" }] }),
        deal({
          id: "b",
          price: 59000,
          my_cost: null,
          payments: [{ id: "p2", amount: 59000, paid_at: "2026-11-20" }],
        }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(18000);
  });

  it("shows a month where materials exceed sales as an explicit refund, not zero", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 18,
      deals: [
        deal({
          id: "a",
          price: 11800,
          my_cost: 59000,
          payments: [{ id: "p1", amount: 11800, paid_at: "2026-11-05" }],
        }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "income", amount: 7200 });
    expect(rows[0].notes).toContain("НДС к возмещению");
  });

  it("uses the forecast date for a deal that has no payments yet", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 18,
      deals: [deal({ id: "a", fallbackDate: "2027-01-10" })],
    });
    expect(rows.map((r) => [r.due_date, r.amount])).toEqual([["2027-02-15", 9000]]);
  });

  it("leaves months that were already due before this month alone", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 18,
      deals: [deal({ id: "a", payments: [{ id: "p1", amount: 118000, paid_at: "2026-09-10" }] })],
    });
    expect(rows).toEqual([]);
  });

  it("marks a row already past its due date as cleared", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: "2026-11-20",
      vatPercent: 18,
      deals: [deal({ id: "a", payments: [{ id: "p1", amount: 118000, paid_at: "2026-10-10" }] })],
    });
    expect(rows[0]).toMatchObject({ status: "cleared", cleared_date: "2026-11-15" });
  });

  it("follows the company VAT rate", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 17,
      deals: [
        deal({
          id: "a",
          price: 117000,
          my_cost: 0,
          payments: [{ id: "p1", amount: 117000, paid_at: "2026-11-05" }],
        }),
      ],
    });
    expect(rows[0].amount).toBe(17000);
  });

  it("skips a month whose VAT is exactly zero", () => {
    const rows = buildVatRows({
      companyId: COMPANY,
      today: TODAY,
      vatPercent: 18,
      deals: [
        deal({
          id: "a",
          price: 59000,
          my_cost: 59000,
          payments: [{ id: "p1", amount: 59000, paid_at: "2026-11-05" }],
        }),
      ],
    });
    expect(rows).toEqual([]);
  });

  it("gives the same external id on every run", () => {
    expect(vatExternalId(COMPANY, "2026-12")).toBe(vatExternalId(COMPANY, "2026-12"));
    expect(vatExternalId(COMPANY, "2026-12")).not.toBe(vatExternalId(COMPANY, "2027-01"));
    expect(vatExternalId(COMPANY, "2026-12")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

function bookFor(rows: Array<Record<string, unknown>>): WorkerCostBook {
  const workers = new Map(rows.map((r) => [r.id as string, r as never]));
  return {
    workers: workers as WorkerCostBook["workers"],
    contextFor: (workerId) => ({
      row: (workerId ? workers.get(workerId) : null) ?? null,
      changes: [],
    }),
  };
}

function shifts(workerId: string, month: string, days: number): WorkerShiftRow[] {
  return Array.from({ length: days }, (_, i) => ({
    worker_id: workerId,
    shift_date: `${month}-${String(i + 1).padStart(2, "0")}`,
    shift_type: "work",
    minutes_worked: 480,
  }));
}

describe("buildPensionRows", () => {
  it("one worker at 500/day, 21 days, 25% and 12.5%: Tazrim row 1 640.63 next month", () => {
    const book = bookFor([
      { id: "w1", first_name: "Dan", last_name: "Levi", daily_rate: 500, hourly_rate: null },
    ]);
    const report = buildMonthPensionReport(shifts("w1", "2026-10", 21), book, "2026-10");
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ gross: 13125, pension: 1640.63, days: 21 });

    const rows = buildPensionRows({ companyId: COMPANY, today: TODAY, reports: [report] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "expense",
      amount: 1640.63,
      due_date: "2026-11-15",
      source: PENSION_SOURCE,
    });
    expect(rows[0].notes).toContain("Пенсия и пицуим");
    expect(rows[0].notes).toContain("расчётный");
  });

  it("sums the workers into one row and leaves out workers without pension", () => {
    const book = bookFor([
      { id: "w1", first_name: "A", last_name: "A", daily_rate: 500 },
      { id: "w2", first_name: "B", last_name: "B", daily_rate: 400 },
      { id: "w3", first_name: "C", last_name: "C", daily_rate: 600, pension_exempt: true },
    ]);
    const all = [...shifts("w1", "2026-10", 10), ...shifts("w2", "2026-10", 10), ...shifts("w3", "2026-10", 10)];
    const report = buildMonthPensionReport(all, book, "2026-10");
    expect(report.rows.map((r) => r.workerId)).toEqual(["w1", "w2"]);
    // 10 x 625 x 12.5% = 781.25 ; 10 x 500 x 12.5% = 625
    expect(report.total).toBe(1406.25);
    expect(buildPensionRows({ companyId: COMPANY, today: TODAY, reports: [report] })[0].amount).toBe(1406.25);
  });

  it("produces no row when nobody is owed pension", () => {
    const book = bookFor([{ id: "w1", daily_rate: 500, pension_exempt: true }]);
    const report = buildMonthPensionReport(shifts("w1", "2026-10", 5), book, "2026-10");
    expect(report.rows).toEqual([]);
    expect(buildPensionRows({ companyId: COMPANY, today: TODAY, reports: [report] })).toEqual([]);
  });

  it("ignores shifts of other months and of deleted workers", () => {
    const book = bookFor([{ id: "w1", daily_rate: 500 }]);
    const all = [...shifts("w1", "2026-09", 5), ...shifts("ghost", "2026-10", 5)];
    expect(buildMonthPensionReport(all, book, "2026-10").rows).toEqual([]);
  });
});
