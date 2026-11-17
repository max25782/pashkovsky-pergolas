import { emptyExtraction, extractInvoice, parseInvoiceModelJson } from "../extract";

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
