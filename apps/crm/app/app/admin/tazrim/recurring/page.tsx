import Link from "next/link";
import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { addRecurringRule, deleteRecurringRule } from "./actions";
import { NavTabs } from "../components/NavTabs";
import { DeleteButton } from "../components/DeleteButton";
import { todayInIsrael } from "@/lib/tazrim/format";
import { nextOccurrence } from "@/lib/tazrim/recurring-schedule";

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "חודשי",
  yearly: "שנתי",
};

export default async function RecurringPage() {
  const { supabase } = await requireTazrimAccess();
  const today = todayInIsrael();

  const { data: vendors } = await supabase
    .from("tz_vendors")
    .select("id, name")
    .order("name");

  const { data: rulesData } = await supabase
    .from("tz_recurring_rules")
    .select(
      "id, label, amount, currency, is_variable, frequency, next_due_date, vendors:tz_vendors(name)"
    )
    .order("next_due_date", { ascending: true, nullsFirst: false });

  // Many-to-one embed is a single object at runtime (the untyped client infers an array).
  const rules = rulesData as unknown as Array<{
    id: string;
    label: string;
    amount: number | null;
    currency: string;
    is_variable: boolean;
    frequency: string;
    next_due_date: string | null;
    vendors: { name: string } | null;
  }> | null;

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Pashkovsky Group · Tazrim
        </div>
        <h1 className="mb-4 text-2xl font-bold">חיובים קבועים</h1>

        <NavTabs active="/app/admin/tazrim/recurring" />

        {!vendors || vendors.length === 0 ? (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
            קודם צריך להוסיף ספק אחד לפחות בעמוד{" "}
            <Link href="/app/admin/tazrim/vendors" className="text-amber-400 underline">
              ספקים
            </Link>
            .
          </div>
        ) : (
          <form
            action={addRecurringRule}
            className="mb-8 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="text-sm font-semibold">הוספת חיוב קבוע</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                name="vendor_id"
                required
                defaultValue=""
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              >
                <option value="" disabled>
                  ספק
                </option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <input
                name="label"
                required
                placeholder="תיאור (לדוגמה: ליסינג, ביטוח, טסט)"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="סכום (₪) — אפשר להשאיר ריק אם משתנה"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <select
                name="frequency"
                defaultValue="monthly"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              >
                <option value="monthly">חודשי</option>
                <option value="yearly">שנתי</option>
              </select>
              <input
                name="next_due_date"
                type="date"
                required
                aria-label="תאריך חיוב הבא"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  name="is_variable"
                  type="checkbox"
                  className="h-4 w-4 accent-amber-500"
                />
                סכום משתנה
              </label>
            </div>
            <button
              type="submit"
              className="self-start rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
            >
              הוספה +
            </button>
          </form>
        )}

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
          {!rules || rules.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">עדיין אין חיובים קבועים.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                  <th className="px-5 py-3 font-medium">ספק</th>
                  <th className="px-5 py-3 font-medium">תיאור</th>
                  <th className="px-5 py-3 font-medium">סכום</th>
                  <th className="px-5 py-3 font-medium">תדירות</th>
                  <th className="px-5 py-3 font-medium">תאריך חיוב הבא</th>
                  <th className="px-5 py-3 font-medium">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-800 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium">
                      {r.vendors?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-400">{r.label}</td>
                    <td className="px-5 py-3 text-zinc-400">
                      {r.is_variable
                        ? "משתנה"
                        : r.amount !== null
                          ? `₪${Number(r.amount).toLocaleString("he-IL")}`
                          : "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {nextOccurrence(r, today) ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-left">
                      <DeleteButton
                        id={r.id}
                        action={deleteRecurringRule}
                        confirmMessage={`למחוק את החיוב "${r.label}"?`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
