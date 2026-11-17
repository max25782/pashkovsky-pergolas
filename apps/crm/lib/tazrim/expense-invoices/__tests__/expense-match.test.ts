import { readExpenseMatch, withExpenseMatch, withoutExpenseMatch } from "../expense-match";

describe("expense amount restore", () => {
  it("keeps the original amount on the cash event and puts it back on unlink", () => {
    const stored = withExpenseMatch({ note: "fuel" }, 114, "inv-1");
    expect(readExpenseMatch(stored)).toEqual({ originalAmount: 114, invoiceId: "inv-1" });
    expect(stored.note).toBe("fuel");

    const again = withExpenseMatch(stored, 999, "inv-2");
    expect(readExpenseMatch(again)?.originalAmount).toBe(114);

    expect(withoutExpenseMatch(again)).toEqual({ note: "fuel" });
    expect(withoutExpenseMatch(withExpenseMatch(null, 50, "inv-3"))).toBeNull();
  });
});
