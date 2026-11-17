"use client";

import { useState } from "react";
import { supplierMonthVariance } from "@/lib/tazrim/expense-invoices/supplier-month";
import {
  applyMatchAction,
  closePeriodAction,
  confirmInvoiceAction,
  createExpenseAction,
  rejectInvoiceAction,
  reopenPeriodAction,
  unlinkMatchAction,
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
  missing_deal: "חשבונית מקדימה חייבת להיות קשורה לעסקה",
  missing_period: "חסר חודש המע״מ",
  awaiting_general_invoice: "יש חשבון מקדים בלי חשבון מס כללי. סמנו סגירה בלי חשבון מס כללי.",
  missing_vendor: "חסר ספק",
  kind_not_tax_invoice: "חשבונית מס כללית אפשרית רק כשסוג המסמך הוא חשבונית מס",
  not_creditable_document: "מסמך שאינו חשבונית מס לא נכנס למע״מ",
  monthly_tax_invoice_has_deal: "חשבונית מס כללית של ספק חודשי לא יכולה להיות קשורה לעסקה",
  monthly_preliminary_needs_deal: "חשבונית מקדימה של ספק חודשי חייבת להיות קשורה לעסקה",
  heic_unreadable: "לא ניתן לקרוא HEIC. שמרו כ-JPEG או PDF",
  original_missing: "אין סכום מקורי לשחזור",
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
  docKind: string;
  dealId: string;
  isMonthly: boolean;
  vatPeriod: string;
  confidence: string;
  issues: string[];
}

const fieldClass =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500";

export function DraftCard({
  draft,
  vendors,
  categories,
  deals,
  preliminary,
}: {
  draft: DraftFields;
  vendors: Array<{ id: string; name: string; issues_monthly_invoice?: boolean }>;
  categories: Array<{ id: string; name: string; vat_recognized_percent: number }>;
  deals: Array<{ id: string; name: string }>;
  preliminary: Array<{ vendorId: string | null; vatPeriod: string | null; total: number }>;
}) {
  const [result, setResult] = useState<InvoiceActionResult | null>(null);
  const [docType, setDocType] = useState(draft.docType);
  const [docKind, setDocKind] = useState(draft.docKind || "preliminary");
  const [categoryId, setCategoryId] = useState(draft.categoryId);
  const [vendorId, setVendorId] = useState(draft.vendorId);
  const [vatPeriod, setVatPeriod] = useState(draft.vatPeriod || draft.invoiceDate.slice(0, 7));
  const [percent, setPercent] = useState(draft.vatRecognizedPercent);
  const categoryPercent = categories.find((category) => category.id === categoryId)?.vat_recognized_percent;
  const vendor = vendors.find((item) => item.id === vendorId);
  const month = /^\d{4}-\d{2}$/.test(vatPeriod) ? vatPeriod : draft.invoiceDate.slice(0, 7);
  const monthly =
    docKind === "tax_invoice" && vendorId && /^\d{4}-\d{2}$/.test(month)
      ? supplierMonthVariance({
          taxTotal: Number(draft.totalAmount) || 0,
          preliminaryTotals: preliminary
            .filter((row) => row.vendorId === vendorId && row.vatPeriod === month)
            .map((row) => row.total),
        })
      : null;

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
        <input
          name="vatPeriod"
          type="month"
          value={vatPeriod}
          onChange={(event) => setVatPeriod(event.target.value)}
          aria-label="חודש מע״מ"
          className={fieldClass}
        />
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
        <select
          name="docKind"
          value={docKind}
          onChange={(event) => setDocKind(event.target.value)}
          aria-label="סוג לחישוב"
          className={fieldClass}
        >
          <option value="preliminary">מקדימה לעסקה (תחזית בלבד)</option>
          <option value="tax_invoice">חשבונית מס / חשבון חודשי</option>
        </select>
        <select name="dealId" defaultValue={draft.dealId} aria-label="עסקה" className={fieldClass}>
          <option value="">עסקה</option>
          {deals.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.name}
            </option>
          ))}
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
        <select
          name="vendorId"
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
          aria-label="ספק"
          className={fieldClass}
        >
          <option value="">ספק במערכת</option>
          {vendors.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.issues_monthly_invoice ? " · חשבון חודשי" : ""}
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
        <p className="mt-2 text-xs text-zinc-500">
          אחוז הזיכוי לפי הקטגוריה: {categoryPercent}. ברירת המחדל 100 — לאשר מול רואה החשבון. אפשר לשנות ידנית.
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">אחוז הזיכוי: ברירת מחדל, לאשר מול רואה החשבון.</p>
      )}
      {vendor && vendor.issues_monthly_invoice !== true && docKind === "preliminary" && docType === "tax_invoice" ? (
        <p className="mt-2 text-xs text-zinc-400">ספק זה לא מוציא חשבון חודשי. באישור המסמך יישמר כחשבונית מס וייכנס לחישוב.</p>
      ) : null}
      {vendor?.issues_monthly_invoice && docKind === "tax_invoice" ? (
        <p className="mt-2 text-xs text-zinc-400">חשבון מס של ספק חודשי מחליף את המקדימות של אותו ספק ואותו חודש.</p>
      ) : null}
      {monthly ? (
        <p className="mt-2 text-xs text-zinc-300">
          חשבון כללי {monthly.taxTotal} ₪ · מקדימות {monthly.preliminaryTotal} ₪ · הפרש לא משויך {monthly.unallocated} ₪.
          המע״מ נלקח מהחשבון הכללי.
        </p>
      ) : null}
      {vendor && vendor.issues_monthly_invoice !== true && docType !== "tax_invoice" ? (
        <p className="mt-2 text-xs text-amber-200">מסמך שאינו חשבונית מס לא נכנס למע״מ</p>
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

export function UnlinkButton({ invoiceId }: { invoiceId: string }) {
  const [result, setResult] = useState<InvoiceActionResult | null>(null);
  return (
    <div>
      <form action={async (formData) => setResult(await unlinkMatchAction(formData))}>
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <button type="submit" className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-200">
          נתק והחזר סכום
        </button>
      </form>
      <Issues result={result} />
    </div>
  );
}

export function PeriodClose({
  period,
  closed,
  awaiting,
}: {
  period: string;
  closed: boolean;
  awaiting: Array<{ name: string; period: string }>;
}) {
  const [result, setResult] = useState<InvoiceActionResult | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      action={async (formData) => setResult(await (closed ? reopenPeriodAction(formData) : closePeriodAction(formData)))}
    >
      {awaiting.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-100">
          {awaiting.map((row) => (
            <li key={`${row.name}-${row.period}`}>ממתין לחשבון מס כללי של {row.name} לחודש {row.period}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="period" value={period} />
        <input name="note" placeholder={closed ? "סיבת פתיחה מחדש" : "הערה (אופציונלי)"} className={fieldClass} />
        {!closed && awaiting.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-amber-100">
            <input type="checkbox" name="confirmWithoutGeneral" value="true" />
            סגירה בלי חשבון מס כללי
          </label>
        ) : null}
        <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950">
          {closed ? "פתיחה מחדש" : "סגירת תקופה"}
        </button>
      </div>
      <Issues result={result} />
    </form>
  );
}
