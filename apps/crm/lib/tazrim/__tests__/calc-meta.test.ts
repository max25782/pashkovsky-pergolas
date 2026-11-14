import {
  displayCashNotes,
  formatSourceMonth,
  looksLikeCalcMetaJson,
  parseCalcMeta,
  resolveCalcMeta,
  serializeCalcMeta,
  type PensionCalcMeta,
  type VatCalcMeta,
} from "../calc-meta";

describe("calc-meta", () => {
  const vatMeta: VatCalcMeta = {
    v: 1,
    kind: "vat_payable",
    sourceMonth: "2026-10",
    vatPercent: 18,
    total: 39020.92,
    lines: [
      {
        dealId: "d1",
        dealName: "לקוח",
        paymentId: "p1",
        paymentAmount: 100000,
        paidDate: "2026-10-05",
        vatOnPayment: 15254.24,
        materialsVatDeduction: 0,
        vatPayable: 15254.24,
        noMaterials: true,
      },
    ],
  };

  it("round-trips VAT meta without localized text", () => {
    const raw = serializeCalcMeta(vatMeta);
    expect(raw).not.toMatch(/НДС|מע״מ|VAT payable/);
    expect(parseCalcMeta(raw)).toEqual(vatMeta);
  });

  it("round-trips pension meta", () => {
    const meta: PensionCalcMeta = {
      v: 1,
      kind: "pension",
      sourceMonth: "2026-10",
      total: 13665.63,
      lines: [
        {
          workerId: "w1",
          workerName: "Dan",
          days: 21,
          gross: 13125,
          pensionRate: 12.5,
          pension: 1640.63,
        },
      ],
    };
    expect(parseCalcMeta(serializeCalcMeta(meta))).toEqual(meta);
  });

  it("rejects legacy Russian prose", () => {
    expect(parseCalcMeta("НДС к уплате за 10/2026 (расчётный)")).toBeNull();
  });

  it("formats source month as MM/YYYY", () => {
    expect(formatSourceMonth("2026-10")).toBe("10/2026");
  });

  it("hides CalcMeta JSON from displayCashNotes but keeps manual notes", () => {
    expect(displayCashNotes(serializeCalcMeta(vatMeta))).toBeNull();
    expect(displayCashNotes('{"kind":"vat_payable","broken":true}')).toBeNull();
    expect(displayCashNotes("דלק למשאית")).toBe("דלק למשאית");
    expect(looksLikeCalcMetaJson(serializeCalcMeta(vatMeta))).toBe(true);
  });

  it("prefers calc_meta column over notes JSON", () => {
    expect(
      resolveCalcMeta({
        calc_meta: vatMeta,
        notes: serializeCalcMeta({ ...vatMeta, total: 1 }),
      }),
    ).toEqual(vatMeta);
    expect(resolveCalcMeta({ notes: serializeCalcMeta(vatMeta) })).toEqual(vatMeta);
  });
});
