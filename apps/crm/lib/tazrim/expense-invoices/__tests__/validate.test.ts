import {
  amountsClose,
  isDuplicateConfirmed,
  normalizeInvoiceNumber,
  normalizeSupplierName,
  normalizeSupplierTaxId,
  recognizedVatAmount,
  resolveVatPeriod,
  validateInvoiceDraft,
  vatPeriodFromDate,
  type InvoiceDraft,
} from "../validate";

function draft(overrides: Partial<InvoiceDraft> = {}): InvoiceDraft {
  return {
    supplierName: "דלק",
    supplierTaxId: "51-411111-1",
    invoiceNumber: "A 100",
    invoiceDate: "2026-11-03",
    docType: "tax_invoice",
    currency: "ILS",
    netAmount: 100,
    vatRate: 18,
    vatAmount: 18,
    totalAmount: 118,
    allocationNumber: "999",
    vatRecognizedPercent: 100,
    categoryId: null,
    vendorId: null,
    ...overrides,
  };
}

describe("invoice normalization", () => {
  it("keeps only digits in a tax id and strips spaces from the invoice number", () => {
    expect(normalizeSupplierTaxId("51-411111-1")).toBe("514111111");
    expect(normalizeInvoiceNumber(" a 100 ")).toBe("A100");
    expect(normalizeSupplierName("  דלק  בע\"מ ")).toBe("דלק בעמ");
    expect(vatPeriodFromDate("2026-11-03")).toBe("2026-11");
    expect(resolveVatPeriod("2026-12-02", "2026-11")).toBe("2026-11");
    expect(resolveVatPeriod("2026-12-02", null)).toBe("2026-12");
    expect(vatPeriodFromDate("03/11/2026")).toBe("");
  });
});

describe("invoice validation", () => {
  it("accepts net × rate and net + VAT within 2 agorot", () => {
    expect(amountsClose(18, 18.02)).toBe(true);
    expect(amountsClose(18, 18.03)).toBe(false);
    const issues = validateInvoiceDraft(draft({ vatAmount: 18.02, totalAmount: 118.02 }), {
      existingConfirmed: [],
      mode: "confirm",
    });
    expect(issues.filter((issue) => issue.blocking)).toEqual([]);
  });

  it("blocks a VAT amount that does not match the rate, and a total that does not add up", () => {
    const issues = validateInvoiceDraft(draft({ vatAmount: 20, totalAmount: 120 }), {
      existingConfirmed: [],
      mode: "confirm",
    });
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["vat_mismatch"]));
    const total = validateInvoiceDraft(draft({ totalAmount: 119 }), {
      existingConfirmed: [],
      mode: "confirm",
    });
    expect(total.map((issue) => issue.code)).toContain("total_mismatch");
  });

  it("blocks a second confirmed invoice with the same supplier and number", () => {
    const existing = [{ id: "other", supplierTaxId: "514111111", invoiceNumber: "A100" }];
    expect(isDuplicateConfirmed(draft(), existing, "self")).toBe(true);
    const issues = validateInvoiceDraft(draft(), { existingConfirmed: existing, selfId: "self", mode: "confirm" });
    expect(issues.map((issue) => issue.code)).toContain("duplicate_invoice");
  });

  it("marks a receipt as not creditable and forces recognized VAT to zero", () => {
    const issues = validateInvoiceDraft(
      draft({ docType: "receipt", vatAmount: 18, totalAmount: 118, allocationNumber: null }),
      { existingConfirmed: [], mode: "review" },
    );
    expect(issues).toEqual([{ code: "receipt_not_creditable", blocking: false }]);
    expect(
      recognizedVatAmount({
        docType: "receipt",
        vatAmount: 18,
        vatRecognizedPercent: 100,
        confirmed: true,
      }),
    ).toBe(0);
  });

  it("recognizes only the accountant's percent of a confirmed tax invoice", () => {
    expect(
      recognizedVatAmount({
        docType: "tax_invoice",
        vatAmount: 18,
        vatRecognizedPercent: 50,
        confirmed: true,
      }),
    ).toBe(9);
    expect(
      recognizedVatAmount({
        docType: "tax_invoice",
        vatAmount: 18,
        vatRecognizedPercent: 100,
        confirmed: false,
      }),
    ).toBe(0);
  });
});
