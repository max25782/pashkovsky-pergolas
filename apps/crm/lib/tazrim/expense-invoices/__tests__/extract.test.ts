import { AWAIT_TAX_INVOICE_MESSAGE, TAX_INVOICE_WORDS_WARNING } from "../document-copy";
import { emptyExtraction, extractInvoice, INVOICE_READ_PROMPT, parseInvoiceModelJson } from "../extract";
import { recognizedPercentDefault } from "../validate";

describe("extractInvoice", () => {
  it("parses a model JSON payload and normalizes the tax id and date", () => {
    const parsed = parseInvoiceModelJson(
      JSON.stringify({
        supplierName: "דלק",
        supplierTaxId: "51-411111-1",
        invoiceNumber: "a 10",
        invoiceDate: "03/11/2026",
        docType: "tax_invoice",
        currency: "ils",
        netAmount: "100",
        vatRate: 18,
        vatAmount: 18,
        totalAmount: 118,
        allocationNumber: " 42 ",
        confidence: 0.91,
      }),
    );
    expect(parsed.supplierTaxId).toBe("514111111");
    expect(parsed.invoiceNumber).toBe("A10");
    expect(parsed.invoiceDate).toBe("2026-11-03");
    expect(parsed.currency).toBe("ILS");
    expect(parsed.netAmount).toBe(100);
    expect(parsed.allocationNumber).toBe("42");
    expect(parsed.unavailable).toBe(false);
    expect(parsed.docType).toBe("tax_invoice");
  });

  it("treats VAT plus a seller tax id as a tax invoice even without the words, and a tax-invoice receipt always", () => {
    expect(INVOICE_READ_PROMPT).toContain("חשבונית מס קבלה");
    expect(INVOICE_READ_PROMPT).toContain("mentionsTaxInvoiceWords");
    expect(AWAIT_TAX_INVOICE_MESSAGE).toBe("טען חשבונית מס כשמתקבלת");
    expect(TAX_INVOICE_WORDS_WARNING).toContain("חשבונית מס");

    const till = parseInvoiceModelJson(
      JSON.stringify({
        supplierName: "Paz",
        supplierTaxId: "514111111",
        docType: "receipt",
        mentionsTaxInvoiceWords: false,
        vatAmount: 18,
        netAmount: 100,
        totalAmount: 118,
      }),
    );
    expect(till.docType).toBe("tax_invoice");
    expect(till.taxInvoiceWordsAbsent).toBe(true);
    expect(till.sellerTaxIdAbsent).toBe(false);
    expect(
      recognizedPercentDefault({
        docType: till.docType,
        vatAmount: till.vatAmount,
        sellerTaxIdAbsent: till.sellerTaxIdAbsent,
        categoryPercent: 100,
      }),
    ).toBe(100);

    const combined = parseInvoiceModelJson(
      JSON.stringify({
        docType: "receipt",
        taxInvoiceReceipt: true,
        mentionsTaxInvoiceWords: false,
        vatAmount: null,
        supplierTaxId: null,
      }),
    );
    expect(combined.docType).toBe("tax_invoice");
    expect(combined.taxInvoiceWordsAbsent).toBe(false);

    const plain = parseInvoiceModelJson(
      JSON.stringify({
        docType: "receipt",
        mentionsTaxInvoiceWords: false,
        supplierTaxId: "514111111",
        vatAmount: null,
      }),
    );
    expect(plain.docType).toBe("receipt");

    const missingSeller = parseInvoiceModelJson(
      JSON.stringify({
        docType: "tax_invoice",
        mentionsTaxInvoiceWords: true,
        vatAmount: 18,
        supplierTaxId: "",
      }),
    );
    expect(missingSeller.docType).toBe("tax_invoice");
    expect(missingSeller.sellerTaxIdAbsent).toBe(true);
    expect(missingSeller.taxInvoiceWordsAbsent).toBe(false);
    expect(
      recognizedPercentDefault({
        docType: missingSeller.docType,
        vatAmount: missingSeller.vatAmount,
        sellerTaxIdAbsent: missingSeller.sellerTaxIdAbsent,
        categoryPercent: 100,
      }),
    ).toBe(0);
  });

  it("does not log the document text when the model answers or when the call fails", async () => {
    const secret = "514999111";
    const supplier = "סודי בעמ";
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const previous = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "test-key";

    try {
      const ok = await extractInvoice(
        { bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" },
        {
          fetch: async () =>
            new Response(
              JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [{ text: JSON.stringify({ supplierName: supplier, supplierTaxId: secret }) }],
                    },
                  },
                ],
              }),
              { status: 200 },
            ),
        },
      );
      expect(ok.supplierTaxId).toBe(secret);

      const failed = await extractInvoice(
        { bytes: new Uint8Array([1]), mimeType: "image/jpeg" },
        {
          fetch: async () => new Response(JSON.stringify({ error: { message: secret } }), { status: 500 }),
        },
      );
      expect(failed).toEqual(emptyExtraction());

      const dumped = [...errorSpy.mock.calls, ...logSpy.mock.calls]
        .flat()
        .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
        .join("\n");
      expect(dumped).not.toContain(secret);
      expect(dumped).not.toContain(supplier);
      expect(dumped).not.toContain("test-key");
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      if (previous === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previous;
    }
  });
});
