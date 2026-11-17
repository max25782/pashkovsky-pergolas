import { matchInvoice, reconcileInvoices, type MatchExpense, type MatchInvoice } from "../match";

const COMPANY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function invoice(overrides: Partial<MatchInvoice> = {}): MatchInvoice {
  return {
    id: "inv-1",
    companyId: COMPANY_A,
    vendorId: "vendor-1",
    supplierName: "דלק",
    totalAmount: 118,
    invoiceDate: "2026-11-03",
    ...overrides,
  };
}

function expense(overrides: Partial<MatchExpense> = {}): MatchExpense {
  return {
    id: "exp-1",
    companyId: COMPANY_A,
    vendorId: "vendor-1",
    vendorName: "דלק",
    amount: 118,
    dueDate: "2026-11-05",
    source: "manual",
    ...overrides,
  };
}

describe("invoice reconciliation", () => {
  it("matches the same supplier inside the amount and date window", () => {
    const result = matchInvoice(invoice(), [expense({ amount: 114, dueDate: "2026-11-20" })]);
    expect(result).toMatchObject({
      status: "matched",
      expenseId: "exp-1",
      estimatedAmount: 114,
      varianceAmount: 4,
    });
  });

  it("does not match a different supplier, a far date, or an amount outside the tolerance", () => {
    expect(matchInvoice(invoice(), [expense({ vendorId: "other", vendorName: "אחר" })]).status).toBe("none");
    expect(matchInvoice(invoice(), [expense({ dueDate: "2026-12-20" })]).status).toBe("none");
    expect(matchInvoice(invoice({ totalAmount: 200 }), [expense({ amount: 100 })]).status).toBe("none");
  });

  it("offers every compatible expense and does not pick one", () => {
    const result = matchInvoice(invoice({ invoiceDate: "2026-11-03" }), [
      expense({ id: "exp-1", amount: 118, dueDate: "2026-11-03" }),
      expense({ id: "exp-2", amount: 114, dueDate: "2026-11-03" }),
    ]);
    expect(result.status).toBe("choice");
    if (result.status === "choice") {
      expect(result.expenseIds.sort()).toEqual(["exp-1", "exp-2"]);
    }
    const month = reconcileInvoices(
      [invoice()],
      [expense({ id: "exp-1" }), expense({ id: "exp-2" })],
    );
    expect(month.matches[0].status).toBe("choice");
    expect(month.expensesWithoutInvoice).toEqual([]);
  });

  it("does not match an expense that belongs to another company", () => {
    const result = matchInvoice(invoice(), [expense({ companyId: COMPANY_B })]);
    expect(result.status).toBe("none");
  });

  it("keeps both invoices as suggestions when they fit the same expense", () => {
    const month = reconcileInvoices(
      [
        invoice({ id: "near", totalAmount: 118 }),
        invoice({ id: "far", totalAmount: 113 }),
      ],
      [expense({ amount: 118 })],
    );
    expect(month.matches.find((row) => row.invoiceId === "near")).toMatchObject({
      status: "matched",
      expenseId: "exp-1",
    });
    expect(month.matches.find((row) => row.invoiceId === "far")).toMatchObject({
      status: "matched",
      expenseId: "exp-1",
    });
  });
});
