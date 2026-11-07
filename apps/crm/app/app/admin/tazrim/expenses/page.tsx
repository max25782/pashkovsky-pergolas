import Link from "next/link";
import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { addExpense } from "./actions";
import { NavTabs } from "../components/NavTabs";
import { ExpenseRow } from "./expense-row";

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "העברה בנקאית" },
  { value: "cash", label: "מזומן" },
  { value: "card", label: "כרטיס" },
];

export default async function ExpensesPage() {
  const { supabase } = await requireTazrimAccess();

  const { data: vendors } = await supabase
    .from("tz_vendors")
    .select("id, name")
    .order("name");

  const { data: expensesData } = await supabase
    .from("tz_cash_events")
    .select("id, amount, due_date, payment_method, notes, vendor_id, vendors:tz_vendors(name)")
    .not("payment_method", "is", null)
    .order("due_date", { ascending: true });

  // Many-to-one embed is a single object at runtime (the untyped client infers an array).
  const expenses = expensesData as unknown as Array<{
    id: string;
    amount: number;
    due_date: string;
    payment_method: string | null;
    notes: string | null;
    vendor_id: string | null;
    vendors: { name: string } | null;
  }> | null;

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Pashkovsky Group · Tazrim
        </div>
        <h1 className="mb-4 text-2xl font-bold">הוצאות</h1>

        <NavTabs active="/app/admin/tazrim/expenses" />

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
            action={addExpense}
            className="mb-8 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="text-sm font-semibold">הוספת הוצאה</div>
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
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="סכום (₪)"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <input
                name="due_date"
                type="date"
                required
                aria-label="תאריך"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <select
                name="payment_method"
                required
                defaultValue="bank_transfer"
                aria-label="אמצעי תשלום"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <input
                name="notes"
                placeholder="הערות (אופציונלי)"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 sm:col-span-2"
              />
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
          {!expenses || expenses.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">עדיין אין הוצאות.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                  <th className="px-5 py-3 font-medium">ספק</th>
                  <th className="px-5 py-3 font-medium">סכום</th>
                  <th className="px-5 py-3 font-medium">תאריך</th>
                  <th className="px-5 py-3 font-medium">אמצעי תשלום</th>
                  <th className="px-5 py-3 font-medium">הערות</th>
                  <th className="px-5 py-3 font-medium">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <ExpenseRow
                    key={e.id}
                    expense={{
                      id: e.id,
                      amount: Number(e.amount),
                      due_date: e.due_date,
                      payment_method: e.payment_method,
                      notes: e.notes,
                      vendor_id: e.vendor_id,
                      vendor_name: e.vendors?.name ?? null,
                    }}
                    vendors={vendors ?? []}
                    paymentMethods={PAYMENT_METHODS}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
