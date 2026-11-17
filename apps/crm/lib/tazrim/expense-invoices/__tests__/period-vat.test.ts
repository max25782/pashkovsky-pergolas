import { buildVatRows, type VatDealInput } from "@/lib/tazrim/vat-pension-rows";
import { applyPeriodVat, computePeriodVat, withoutLockedPeriods } from "../period-vat";

describe("period VAT", () => {
  it("uses the materials estimate and marks it when no tax invoice is confirmed", () => {
    const period = computePeriodVat({
      vatOnSales: 18000,
      estimatedInputVat: 9000,
      invoices: [
        {
          vatPeriod: "2026-11",
          docType: "receipt",
          vatAmount: 50,
          vatRecognizedPercent: 100,
          confirmed: true,
        },
      ],
    });
    expect(period).toMatchObject({
      vatPayable: 9000,
      basis: "estimate",
      estimated: true,
      recognizedFromInvoices: 0,
    });
  });

  it("subtracts confirmed invoice VAT times the recognized percent, and ignores receipts", () => {
    const period = computePeriodVat({
      vatOnSales: 18000,
      estimatedInputVat: 9000,
      invoices: [
        {
          vatPeriod: "2026-11",
          docType: "tax_invoice",
          vatAmount: 1000,
          vatRecognizedPercent: 66,
          confirmed: true,
        },
        {
          vatPeriod: "2026-11",
          docType: "receipt",
          vatAmount: 400,
          vatRecognizedPercent: 100,
          confirmed: true,
        },
        {
          vatPeriod: "2026-11",
          docType: "tax_invoice",
          vatAmount: 500,
          vatRecognizedPercent: 100,
          confirmed: false,
        },
      ],
    });
    expect(period.recognizedFromInvoices).toBe(660);
    expect(period.vatPayable).toBe(17340);
    expect(period.basis).toBe("invoices");
    expect(period.estimated).toBe(false);
  });

  it("keeps the existing VAT row amount on the estimate path and replaces it when invoices exist", () => {
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
    expect(row.calc_meta).toMatchObject({ estimated: true, inputVatBasis: "estimate" });

    const estimated = applyPeriodVat(row, []);
    expect(estimated.amount).toBe(9000);

    const adjusted = applyPeriodVat(row, [
      {
        vatPeriod: "2026-11",
        docType: "tax_invoice",
        vatAmount: 1000,
        vatRecognizedPercent: 50,
        confirmed: true,
      },
    ]);
    expect(adjusted.amount).toBe(17500);
    expect(adjusted.calc_meta).toMatchObject({
      inputVatBasis: "invoices",
      estimated: false,
      inputVatRecognized: 500,
    });
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
