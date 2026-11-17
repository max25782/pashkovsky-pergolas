import { buildVatRows, type VatDealInput } from "@/lib/tazrim/vat-pension-rows";
import {
  applyCloseVat,
  applyPeriodVat,
  computeCloseVat,
  computeForecastVat,
  supplierMonthVariance,
  withoutLockedPeriods,
  type PeriodInvoiceInput,
} from "../period-vat";

function invoice(overrides: Partial<PeriodInvoiceInput> = {}): PeriodInvoiceInput {
  return {
    vatPeriod: "2026-11",
    docType: "tax_invoice",
    docKind: "preliminary",
    vendorId: "vendor-a",
    dealId: "deal-a",
    netAmount: 10000,
    vatAmount: 1800,
    vatRecognizedPercent: 100,
    confirmed: true,
    superseded: false,
    ...overrides,
  };
}

const deals = [
  { dealId: "deal-a", materialsVat: 9000 },
  { dealId: "deal-b", materialsVat: 9000 },
  { dealId: "deal-c", materialsVat: 9000 },
];

describe("forecast and close VAT", () => {
  it("keeps the other deals on their estimate when one deal has a preliminary invoice", () => {
    const forecast = computeForecastVat({
      vatOnSales: 54000,
      vatPercent: 18,
      deals,
      invoices: [invoice()],
      period: "2026-11",
    });
    expect(forecast.vatPayable).toBe(27000);
    expect(forecast.deals.find((deal) => deal.dealId === "deal-b")).toMatchObject({
      estimatedVat: 9000,
      preliminaryVat: 0,
      estimated: true,
    });
    expect(forecast.deals.find((deal) => deal.dealId === "deal-c")?.estimatedVat).toBe(9000);
    expect(forecast.deals.find((deal) => deal.dealId === "deal-a")).toMatchObject({
      estimatedVat: 7200,
      preliminaryVat: 1800,
    });
    expect(forecast.estimated).toBe(true);
  });

  it("counts a monthly tax invoice once and does not add the preliminary it replaces", () => {
    const forecast = computeForecastVat({
      vatOnSales: 54000,
      vatPercent: 18,
      deals,
      invoices: [
        invoice(),
        invoice({
          id: "tax",
          docKind: "tax_invoice",
          dealId: null,
          netAmount: 13888.89,
          vatAmount: 2500,
          vatRecognizedPercent: 100,
        }),
      ],
      period: "2026-11",
    });
    expect(forecast.recognizedFromPreliminary).toBe(0);
    expect(forecast.recognizedFromTaxInvoices).toBe(2500);
    expect(forecast.deals.find((deal) => deal.dealId === "deal-b")?.estimatedVat).toBe(9000);
    expect(forecast.inputVat).toBe(27700);
  });

  it("does not let a tax invoice of another month replace this month's preliminary", () => {
    const invoices = [
      invoice(),
      invoice({
        docKind: "tax_invoice",
        vatPeriod: "2026-12",
        dealId: null,
        vatAmount: 2500,
        netAmount: 13888.89,
      }),
    ];
    const november = computeForecastVat({
      vatOnSales: 54000,
      vatPercent: 18,
      deals,
      invoices,
      period: "2026-11",
    });
    expect(november.recognizedFromPreliminary).toBe(1800);
    expect(november.recognizedFromTaxInvoices).toBe(0);
    const december = computeForecastVat({
      vatOnSales: 0,
      vatPercent: 18,
      deals: [],
      invoices,
      period: "2026-12",
    });
    expect(december.recognizedFromTaxInvoices).toBe(2500);
    expect(december.recognizedFromPreliminary).toBe(0);
  });

  it("ignores preliminary documents when the period is closed", () => {
    const closed = computeCloseVat({
      vatOnSales: 18000,
      period: "2026-11",
      invoices: [
        invoice({ vatAmount: 1800 }),
        invoice({
          docKind: "tax_invoice",
          dealId: null,
          vatAmount: 500,
          vatRecognizedPercent: 100,
          netAmount: 2777.78,
        }),
      ],
    });
    expect(closed.preliminaryIgnored).toBe(1800);
    expect(closed.inputVat).toBe(500);
    expect(closed.vatPayable).toBe(17500);
  });

  it("shows the unallocated gap between a monthly invoice and its preliminary documents", () => {
    expect(supplierMonthVariance({ taxTotal: 1180, preliminaryTotals: [700, 180] })).toEqual({
      taxTotal: 1180,
      preliminaryTotal: 880,
      unallocated: 300,
    });
  });

  it("does not change the stored VAT row when every deal is still an estimate", () => {
    const deal: VatDealInput = {
      id: "a",
      customerName: "Customer",
      price: 118000,
      my_cost: 59000,
      labor: 0,
      payments: [{ id: "p1", amount: 118000, paid_at: "2026-11-05" }],
      fallbackDate: "2026-11-30",
    };
    const [row] = buildVatRows({
      companyId: "company-1",
      today: "2026-11-13",
      vatPercent: 18,
      deals: [deal],
    });
    expect(row.amount).toBe(9000);
    const estimated = applyPeriodVat(row, []);
    expect(estimated.amount).toBe(9000);
    expect(estimated.calc_meta).toMatchObject({ estimated: true, inputVatBasis: "estimate" });
  });

  it("writes the close figure from tax invoices only", () => {
    const deal: VatDealInput = {
      id: "a",
      customerName: "Customer",
      price: 118000,
      my_cost: 59000,
      labor: 0,
      payments: [{ id: "p1", amount: 118000, paid_at: "2026-11-05" }],
      fallbackDate: "2026-11-30",
    };
    const [row] = buildVatRows({
      companyId: "company-1",
      today: "2026-11-13",
      vatPercent: 18,
      deals: [deal],
    });
    const closed = applyCloseVat(row, [
      invoice({ dealId: "a", vatAmount: 1800 }),
      invoice({ docKind: "tax_invoice", dealId: null, vatAmount: 400, netAmount: 2222.22 }),
    ]);
    expect(closed.amount).toBe(17600);
    expect(closed.calc_meta).toMatchObject({ inputVatBasis: "invoices", estimated: false, inputVatRecognized: 400 });
  });

  it("leaves a closed period out of the rows that a sync may overwrite", () => {
    const deal: VatDealInput = {
      id: "a",
      customerName: "Customer",
      price: 118000,
      my_cost: 0,
      payments: [{ id: "p1", amount: 118000, paid_at: "2026-11-05" }],
      fallbackDate: "2026-11-30",
    };
    const rows = buildVatRows({
      companyId: "company-1",
      today: "2026-11-13",
      vatPercent: 18,
      deals: [deal],
    });
    const split = withoutLockedPeriods(rows, new Set(["2026-11"]));
    expect(split.writable).toEqual([]);
    expect(split.lockedExternalIds).toEqual([rows[0].external_id]);
  });
});
