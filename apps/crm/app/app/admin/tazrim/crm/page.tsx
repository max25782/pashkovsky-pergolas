import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { formatFullDate, formatMoney } from "@/lib/tazrim/format";
import { PAYROLL_APPROVED_SOURCE, PAYROLL_SOURCES } from "@/lib/tazrim/payroll";
import { approvePayrollExpense, syncAluminCRM } from "./actions";
import { NavTabs } from "../components/NavTabs";
import { Card, PageHeader } from "../components/dashboard-ui";

const EMPTY_TEXT = "אין נתונים עדיין";

interface IncomeRow {
  id: string;
  notes: string | null;
  amount: number | string;
  due_date: string;
}

function sumAmounts(rows: IncomeRow[]): number {
  return rows.reduce((total, r) => total + Number(r.amount), 0);
}

function formatSyncedAt(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });
}

interface IncomeTableProps {
  title: string;
  rows: IncomeRow[];
}

function IncomeTable({ title, rows }: IncomeTableProps) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="text-lg font-bold text-emerald-400">
          {formatMoney(sumAmounts(rows))}
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">{EMPTY_TEXT}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                <th className="px-5 py-3 font-medium">תיאור</th>
                <th className="px-5 py-3 font-medium">סכום</th>
                <th className="px-5 py-3 font-medium">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-800 last:border-0"
                >
                  <td className="px-5 py-3 font-medium">{r.notes ?? "—"}</td>
                  <td className="px-5 py-3 font-semibold text-emerald-400">
                    {formatMoney(r.amount)}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {formatFullDate(r.due_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

interface PayrollRow extends IncomeRow {
  source: string;
  status: string;
}

function PayrollTable({ rows }: { rows: PayrollRow[] }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">הוצאות עובדים (שכר)</h2>
        <div className="text-lg font-bold text-warn">
          {formatMoney(sumAmounts(rows))}
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">{EMPTY_TEXT}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                <th className="px-5 py-3 font-medium">עובד</th>
                <th className="px-5 py-3 font-medium">סכום</th>
                <th className="px-5 py-3 font-medium">תאריך תשלום</th>
                <th className="px-5 py-3 font-medium">אישור רו״ח</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isApproved = r.source === PAYROLL_APPROVED_SOURCE;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-800 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium">{r.notes ?? "—"}</td>
                    <td className="px-5 py-3 font-semibold text-warn">
                      {formatMoney(r.amount)}
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {formatFullDate(r.due_date)}
                    </td>
                    <td className="px-5 py-3">
                      <form
                        action={approvePayrollExpense}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          defaultValue={Number(r.amount)}
                          aria-label="סכום מאושר"
                          className="w-24 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-amber-500 hover:text-amber-400"
                        >
                          {isApproved ? "עדכן" : "אשר / תקן"}
                        </button>
                        {isApproved && (
                          <span className="text-xs text-emerald-400">מאושר</span>
                        )}
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default async function CrmPage() {
  const { supabase } = await requireTazrimAccess();

  const [
    integrationResult,
    forecastResult,
    doneResult,
    payrollResult,
  ] = await Promise.all([
    supabase
      .from("tz_integrations")
      .select("last_synced_at, status")
      .eq("provider", "alumincrm")
      .maybeSingle(),
    supabase
      .from("tz_cash_events")
      .select("id, notes, amount, due_date")
      .eq("type", "income")
      .eq("status", "planned")
      .eq("source", "alumincrm_forecast")
      .order("due_date", { ascending: true }),
    supabase
      .from("tz_cash_events")
      .select("id, notes, amount, due_date")
      .eq("type", "income")
      .eq("status", "cleared")
      .eq("source", "alumincrm")
      .order("due_date", { ascending: true }),
    supabase
      .from("tz_cash_events")
      .select("id, notes, amount, due_date, source, status")
      .eq("type", "expense")
      .in("source", PAYROLL_SOURCES)
      .order("due_date", { ascending: true }),
  ]);

  const errors = [
    integrationResult.error,
    forecastResult.error,
    doneResult.error,
    payrollResult.error,
  ]
    .filter((e) => e !== null)
    .map((e) => e.message);

  const lastSyncedAt = integrationResult.data?.last_synced_at ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <PageHeader title="סנכרון עם AluminCRM" />

        <NavTabs active="/app/admin/tazrim/crm" />

        {errors.length > 0 && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            חלק מהנתונים לא נטענו: {errors.join(" · ")}
          </div>
        )}

        <Card className="flex flex-col gap-3">
          <form action={syncAluminCRM}>
            <button
              type="submit"
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
            >
              סנכרן עכשיו
            </button>
          </form>
          <div className="text-xs text-zinc-500">
            {lastSyncedAt
              ? `סונכרן לאחרונה: ${formatSyncedAt(lastSyncedAt)}`
              : "עדיין לא סונכרן"}
          </div>
        </Card>

        <IncomeTable
          title="הכנסות צפויות"
          rows={(forecastResult.data ?? []) as IncomeRow[]}
        />
        <IncomeTable
          title="הכנסות שהושלמו"
          rows={(doneResult.data ?? []) as IncomeRow[]}
        />
        <PayrollTable rows={(payrollResult.data ?? []) as PayrollRow[]} />
      </div>
    </div>
  );
}
