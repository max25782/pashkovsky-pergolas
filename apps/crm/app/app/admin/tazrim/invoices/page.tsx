import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { todayInIsrael } from "@/lib/tazrim/format";
import { NavTabs } from "../components/NavTabs";
import {
  isPreliminaryExpense,
  monthBounds,
  reconcileInvoices,
  type MatchExpense,
  type MatchInvoice,
} from "@/lib/tazrim/expense-invoices/match";
import {
  isInvoiceDocType,
  validateInvoiceDraft,
  vatPeriodFromDate,
  type InvoiceDraft,
} from "@/lib/tazrim/expense-invoices/validate";
import { UploadInvoices } from "./upload-invoices";
import { DraftCard, MatchButtons, PeriodClose, type DraftFields } from "./invoice-controls";

interface InvoiceDb {
  id: string;
  company_id: string;
  supplier_name: string | null;
  supplier_tax_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  doc_type: string;
  currency: string | null;
  net_amount: number | string | null;
  vat_rate: number | string | null;
  vat_amount: number | string | null;
  total_amount: number | string | null;
  allocation_number: string | null;
  vat_recognized_percent: number | string | null;
  vat_period: string | null;
  category_id: string | null;
  vendor_id: string | null;
  matched_cash_event_id: string | null;
  estimated_amount: number | string | null;
  variance_amount: number | string | null;
  extraction_confidence: number | string | null;
  confirmed_at: string | null;
}

interface ExpenseDb {
  id: string;
  company_id: string;
  amount: number | string;
  due_date: string;
  source: string;
  vendor_id: string | null;
  notes: string | null;
  vendors: { name: string } | { name: string }[] | null;
}

function textAmount(value: number | string | null): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function asNumber(value: number | string | null): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function vendorLabel(value: ExpenseDb["vendors"]): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0]?.name ?? null) : value.name;
}

function toDraft(row: InvoiceDb): InvoiceDraft {
  return {
    supplierName: row.supplier_name ?? "",
    supplierTaxId: row.supplier_tax_id ?? "",
    invoiceNumber: row.invoice_number ?? "",
    invoiceDate: row.invoice_date ?? "",
    docType: isInvoiceDocType(row.doc_type) ? row.doc_type : "other",
    currency: row.currency || "ILS",
    netAmount: asNumber(row.net_amount),
    vatRate: asNumber(row.vat_rate),
    vatAmount: asNumber(row.vat_amount),
    totalAmount: asNumber(row.total_amount),
    allocationNumber: row.allocation_number,
    vatRecognizedPercent: asNumber(row.vat_recognized_percent) ?? 100,
    categoryId: row.category_id,
    vendorId: row.vendor_id,
  };
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const { supabase, companyId } = await requireTazrimAccess();
  const today = todayInIsrael();
  const period = /^\d{4}-\d{2}$/.test(searchParams.period ?? "") ? (searchParams.period as string) : today.slice(0, 7);
  const bounds = monthBounds(period);

  const [vendorsResult, categoriesResult, documentsResult, invoicesResult, expensesResult, closureResult] =
    await Promise.all([
      supabase.from("tz_vendors").select("id, name").eq("company_id", companyId).order("name"),
      supabase
        .from("tz_expense_categories")
        .select("id, name, vat_recognized_percent")
        .eq("company_id", companyId)
        .order("name"),
      supabase.from("tz_expense_documents").select("id, status, created_at").eq("company_id", companyId),
      supabase.from("tz_expense_invoices").select("*").eq("company_id", companyId),
      bounds
        ? supabase
            .from("tz_cash_events")
            .select("id, company_id, amount, due_date, source, vendor_id, notes, vendors:tz_vendors(name)")
            .eq("company_id", companyId)
            .eq("type", "expense")
            .gte("due_date", bounds.from)
            .lte("due_date", bounds.to)
        : Promise.resolve({ data: [] }),
      supabase
        .from("tz_vat_period_closures")
        .select("closed_at, note")
        .eq("company_id", companyId)
        .eq("vat_period", period)
        .maybeSingle(),
    ]);

  const vendors = (vendorsResult.data ?? []) as Array<{ id: string; name: string }>;
  const categories = (categoriesResult.data ?? []) as Array<{
    id: string;
    name: string;
    vat_recognized_percent: number;
  }>;
  const documents = (documentsResult.data ?? []) as Array<{ status: string; created_at: string }>;
  const invoices = ((invoicesResult.data ?? []) as InvoiceDb[]).filter((row) => row.company_id === companyId);
  const expenses = ((expensesResult.data ?? []) as ExpenseDb[]).filter((row) => row.company_id === companyId);
  const confirmedKeys = invoices
    .filter((row) => row.confirmed_at)
    .map((row) => ({
      id: row.id,
      supplierTaxId: row.supplier_tax_id ?? "",
      invoiceNumber: row.invoice_number ?? "",
    }));

  const drafts: DraftFields[] = invoices
    .filter((row) => !row.confirmed_at)
    .map((row) => {
      const draft = toDraft(row);
      const issues = validateInvoiceDraft(draft, { existingConfirmed: confirmedKeys, selfId: row.id, mode: "review" });
      return {
        invoiceId: row.id,
        supplierName: draft.supplierName,
        supplierTaxId: draft.supplierTaxId,
        invoiceNumber: draft.invoiceNumber,
        invoiceDate: draft.invoiceDate,
        docType: draft.docType,
        currency: draft.currency,
        netAmount: textAmount(draft.netAmount),
        vatRate: textAmount(draft.vatRate),
        vatAmount: textAmount(draft.vatAmount),
        totalAmount: textAmount(draft.totalAmount),
        allocationNumber: draft.allocationNumber ?? "",
        vatRecognizedPercent: String(draft.vatRecognizedPercent),
        categoryId: draft.categoryId ?? "",
        vendorId: draft.vendorId ?? "",
        confidence: row.extraction_confidence === null ? "" : String(row.extraction_confidence),
        issues: issues.map((issue) => issue.code),
      };
    });

  const periodInvoices = invoices.filter((row) => row.vat_period === period || vatPeriodFromDate(row.invoice_date) === period);
  const confirmed = periodInvoices.filter((row) => row.confirmed_at);
  const awaiting = periodInvoices.filter((row) => !row.confirmed_at).length;
  const uploaded = documents.filter((row) => row.created_at.slice(0, 7) === period).length;

  const openConfirmed = confirmed.filter((row) => !row.matched_cash_event_id);
  const matchInvoices: MatchInvoice[] = openConfirmed.flatMap((row) => {
    const total = asNumber(row.total_amount);
    if (!row.invoice_date || total === null) return [];
    return [
      {
        id: row.id,
        companyId,
        vendorId: row.vendor_id,
        supplierName: row.supplier_name ?? "",
        totalAmount: total,
        invoiceDate: row.invoice_date,
      },
    ];
  });
  const monthExpenses = expenses.filter((row) => row.due_date.slice(0, 7) === period);
  const matchExpenses: MatchExpense[] = monthExpenses.map((row) => ({
    id: row.id,
    companyId,
    vendorId: row.vendor_id,
    vendorName: vendorLabel(row.vendors),
    amount: asNumber(row.amount) ?? 0,
    dueDate: row.due_date,
    source: row.source,
  }));
  const reconciliation = reconcileInvoices(matchInvoices, matchExpenses);
  const linked = new Set(confirmed.flatMap((row) => (row.matched_cash_event_id ? [row.matched_cash_event_id] : [])));
  const proposed = new Set(
    reconciliation.matches.flatMap((match) => (match.status === "matched" ? [match.expenseId] : [])),
  );
  const withoutInvoice = monthExpenses.filter(
    (row) => isPreliminaryExpense(row.source) && !linked.has(row.id) && !proposed.has(row.id),
  );
  const variances = confirmed.filter((row) => asNumber(row.variance_amount) !== null && asNumber(row.variance_amount) !== 0);
  const expenseById = new Map(monthExpenses.map((row) => [row.id, row]));
  const closed = Boolean(closureResult.data);

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Pashkovsky Group · Tazrim</div>
        <h1 className="mb-4 text-2xl font-bold">חשבוניות ספקים</h1>
        <NavTabs active="/app/admin/tazrim/invoices" />
        <UploadInvoices />

        <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
            <label className="text-sm text-zinc-400">
              חודש
              <input
                type="month"
                name="period"
                defaultValue={period}
                className="mt-1 block rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm">
              הצג
            </button>
          </form>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <Stat label="הועלו" value={uploaded} />
            <Stat label="אושרו" value={confirmed.length} />
            <Stat label="ממתינות" value={awaiting} />
            <Stat label="הפרשים" value={variances.length} />
            <Stat label="בלי חשבונית" value={withoutInvoice.length} />
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            הוצאה בלי חשבונית לא נכנסת לזיכוי המע״מ. כשאין חשבוניות מאושרות לחודש, ניכוי המע״מ נשאר הערכה לפי עלות החומרים.
          </p>
          <div className="mt-4">
            <PeriodClose period={period} closed={closed} />
            {closed && closureResult.data?.closed_at ? (
              <p className="mt-2 text-xs text-zinc-500">התקופה סגורה. מע״מ התקופה לא משתנה עד פתיחה מחדש.</p>
            ) : null}
          </div>
        </section>

        {drafts.length > 0 ? (
          <section className="mb-8 space-y-4">
            <h2 className="text-lg font-semibold">ממתינות לאישור</h2>
            {drafts.map((draft) => (
              <DraftCard key={draft.invoiceId} draft={draft} vendors={vendors} categories={categories} />
            ))}
          </section>
        ) : null}

        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-semibold">התאמה</h2>
          {reconciliation.matches.length === 0 ? (
            <p className="text-sm text-zinc-500">אין חשבוניות מאושרות שמחכות להתאמה בחודש הזה.</p>
          ) : (
            reconciliation.matches.map((match) => {
              const invoice = confirmed.find((row) => row.id === match.invoiceId);
              const expense = match.status === "matched" ? expenseById.get(match.expenseId) : undefined;
              return (
                <div key={match.invoiceId} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
                  <div className="font-medium">{invoice?.supplier_name || "ספק"} · {invoice?.invoice_number}</div>
                  <div className="text-zinc-400">
                    {match.status === "matched"
                      ? `נמצאה הוצאה ${expense ? vendorLabel(expense.vendors) ?? "" : ""} ${match.estimatedAmount} ₪, הפרש ${match.varianceAmount} ₪`
                      : match.status === "duplicate"
                        ? "כמה הוצאות מתאימות באותה מידה. בחרו ידנית."
                        : "לא נמצאה הוצאה מתאימה."}
                  </div>
                  <div className="mt-2">
                    {match.status === "matched" ? (
                      <MatchButtons invoiceId={match.invoiceId} expenseId={match.expenseId} label="החלף בסכום בפועל" />
                    ) : match.status === "duplicate" ? (
                      <div className="flex flex-wrap gap-2">
                        {match.expenseIds.map((expenseId) => (
                          <MatchButtons key={expenseId} invoiceId={match.invoiceId} expenseId={expenseId} label="שייך הוצאה זו" />
                        ))}
                      </div>
                    ) : (
                      <MatchButtons invoiceId={match.invoiceId} label="צור הוצאה מהחשבונית" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">בלי חשבונית</h2>
          {withoutInvoice.length === 0 ? (
            <p className="text-sm text-zinc-500">אין הוצאות בחודש בלי חשבונית.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {withoutInvoice.map((row) => (
                <li key={row.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                  <span>{vendorLabel(row.vendors) || row.notes || "הוצאה"}</span>
                  <span className="mx-2 text-zinc-500">{row.due_date}</span>
                  <span>{row.amount} ₪</span>
                  <span className="ms-2 text-xs text-amber-200">מע״מ לא נזקף</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
