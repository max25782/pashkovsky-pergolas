"use client";

import { useState } from "react";
import {
  applyMatchAction,
  closePeriodAction,
  confirmInvoiceAction,
  createExpenseAction,
  rejectInvoiceAction,
  reopenPeriodAction,
  type InvoiceActionResult,
} from "./actions";

const ISSUE_TEXT: Record<string, string> = {
  vat_mismatch: "המע״מ לא תואם לסכום לפני מע״מ כפול השיעור (סטייה מעל 2 אגורות)",
  total_mismatch: "סכום לפני מע״מ ועוד מע״מ לא שווים לסה״כ",
  duplicate_invoice: "חשבונית עם אותו מספר ואותו עוסק כבר אושרה",
  receipt_not_creditable: "קבלה — מע״מ לא לזיכוי",
  missing_supplier: "חסר שם ספק",
  missing_tax_id: "חסר ח.פ. / ע.מ.",
  missing_number: "חסר מספר חשבונית",
  missing_date: "חסר תאריך",
  missing_amounts: "חסרים סכומים",
  bad_percent: "אחוז הזיכוי חייב להיות בין 0 ל-100",
  allocation_missing: "אין מספר הקצאה. סף החובה נקבע על ידי רואה החשבון, אין חסימה אוטומטית",
  period_closed: "התקופה סגורה. פתחו אותה מחדש כדי לשנות",
  not_a_match: "ההוצאה לא מתאימה לספק, לסכום או לחלון התאריכים",
  duplicate: "ההוצאה כבר שויכה לחשבונית אחרת",
};

function Issues({ result }: { result: InvoiceActionResult | null }) {
  if (!result) return null;
  const codes: string[] = result.issues?.map((issue) => issue.code) ?? [];
  if (result.error && !codes.includes(result.error)) codes.unshift(result.error);
  if (codes.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs text-amber-200">
      {codes.map((code) => (
        <li key={code}>{ISSUE_TEXT[code] ?? code}</li>
      ))}
    </ul>
  );
}

export interface DraftFields {
  invoiceId: string;
  supplierName: string;
  supplierTaxId: string;
  invoiceNumber: string;
  invoiceDate: string;
  docType: string;
  currency: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  totalAmount: string;
  allocationNumber: string;
  vatRecognizedPercent: string;
  categoryId: string;
  vendorId: string;
  confidence: string;
  issues: string[];
}

const fieldClass =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500";

export function DraftCard({
  draft,
  vendors,
  categories,
}: {
  draft: DraftFields;
  vendors: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; vat_recognized_percent: number }>;
}) {
  const [result, setResult] = useState<InvoiceActionResult | null>(null);
  const [docType, setDocType] = useState(draft.docType);
  const [categoryId, setCategoryId] = useState(draft.categoryId);
  const [percent, setPercent] = useState(draft.vatRecognizedPercent);
  const categoryPercent = categories.find((category) => category.id === categoryId)?.vat_recognized_percent;

  return (
    <form
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
      action={async (formData) => setResult(await confirmInvoiceAction(formData))}
    >
      <input type="hidden" name="invoiceId" value={draft.invoiceId} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">ממתין לאישור</div>
        {draft.confidence ? <div className="text-xs text-zinc-500">ביטחון זיהוי {draft.confidence}</div> : null}
      </div>
      <ul className="mb-3 space-y-1 text-xs text-amber-200">
        {draft.issues.map((code) => (
          <li key={code}>{ISSUE_TEXT[code] ?? code}</li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="supplierName" defaultValue={draft.supplierName} placeholder="ספק" className={fieldClass} />
        <input name="supplierTaxId" defaultValue={draft.supplierTaxId} placeholder="ח.פ. / ע.מ." className={fieldClass} />
        <input name="invoiceNumber" defaultValue={draft.invoiceNumber} placeholder="מספר חשבונית" className={fieldClass} />
        <input name="invoiceDate" type="date" defaultValue={draft.invoiceDate} aria-label="תאריך" className={fieldClass} />
        <select
          name="docType"
          value={docType}
          onChange={(event) => setDocType(event.target.value)}
          aria-label="סוג מסמך"
          className={fieldClass}
        >
          <option value="tax_invoice">חשבונית מס</option>
          <option value="receipt">קבלה</option>
          <option value="other">אחר</option>
        </select>
        <input name="currency" defaultValue={draft.currency || "ILS"} aria-label="מטבע" className={fieldClass} />
        <input name="netAmount" defaultValue={draft.netAmount} placeholder="לפני מע״מ" className={fieldClass} />
        <input name="vatRate" defaultValue={draft.vatRate} placeholder="שיעור מע״מ %" className={fieldClass} />
        <input name="vatAmount" defaultValue={draft.vatAmount} placeholder="מע״מ" className={fieldClass} />
        <input name="totalAmount" defaultValue={draft.totalAmount} placeholder="סה״כ" className={fieldClass} />
        <input name="allocationNumber" defaultValue={draft.allocationNumber} placeholder="מספר הקצאה" className={fieldClass} />
        <input
          name="vatRecognizedPercent"
          value={docType === "receipt" ? "0" : percent}
          onChange={(event) => setPercent(event.target.value)}
          placeholder="אחוז זיכוי"
          aria-label="אחוז זיכוי"
          className={fieldClass}
        />
        <select name="vendorId" defaultValue={draft.vendorId} aria-label="ספק" className={fieldClass}>
          <option value="">ספק במערכת</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
        <select
          name="categoryId"
          value={categoryId}
          onChange={(event) => {
            const next = event.target.value;
            setCategoryId(next);
            const found = categories.find((category) => category.id === next);
            if (found && docType !== "receipt") setPercent(String(found.vat_recognized_percent));
          }}
          aria-label="קטגוריה"
          className={fieldClass}
        >
          <option value="">קטגוריה</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} · {category.vat_recognized_percent}%
            </option>
          ))}
        </select>
      </div>
      {categoryPercent !== undefined && docType !== "receipt" ? (
        <p className="mt-2 text-xs text-zinc-500">אחוז הזיכוי לפי הקטגוריה: {categoryPercent}. אפשר לשנות ידנית.</p>
      ) : null}
      {docType === "receipt" ? <p className="mt-2 text-xs text-amber-200">קבלה — המע״מ לא ייזקף.</p> : null}
      <Issues result={result} />
      <div className="mt-4 flex gap-2">
        <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">
          אישור
        </button>
        <button
          type="button"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          onClick={async () => {
            const form = new FormData();
            form.set("invoiceId", draft.invoiceId);
            setResult(await rejectInvoiceAction(form));
          }}
        >
          דחייה
        </button>
      </div>
    </form>
  );
}

export function MatchButtons({
  invoiceId,
  expenseId,
  label,
}: {
  invoiceId: string;
  expenseId?: string;
  label: string;
}) {
  const [result, setResult] = useState<InvoiceActionResult | null>(null);
  return (
    <div>
      {expenseId ? (
        <form action={async (formData) => setResult(await applyMatchAction(formData))}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <input type="hidden" name="expenseId" value={expenseId} />
          <button type="submit" className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950">
            {label}
          </button>
        </form>
      ) : (
        <form action={async (formData) => setResult(await createExpenseAction(formData))}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button type="submit" className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200">
            {label}
          </button>
        </form>
      )}
      <Issues result={result} />
    </div>
  );
}

export function PeriodClose({ period, closed }: { period: string; closed: boolean }) {
  const [result, setResult] = useState<InvoiceActionResult | null>(null);
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
      action={async (formData) => setResult(await (closed ? reopenPeriodAction(formData) : closePeriodAction(formData)))}
    >
      <input type="hidden" name="period" value={period} />
      <input name="note" placeholder={closed ? "סיבת פתיחה מחדש" : "הערה (אופציונלי)"} className={fieldClass} />
      <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">
        {closed ? "פתיחה מחדש" : "סגירת תקופה"}
      </button>
      <Issues result={result} />
    </form>
  );
}
