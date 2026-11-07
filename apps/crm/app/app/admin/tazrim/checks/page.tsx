import Link from "next/link";
import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { addCheck, deleteCheck } from "./actions";
import { NavTabs } from "../components/NavTabs";
import { DeleteButton } from "../components/DeleteButton";

export default async function ChecksPage() {
  const { supabase } = await requireTazrimAccess();

  const { data: vendors } = await supabase
    .from("tz_vendors")
    .select("id, name")
    .order("name");

  const { data: checks } = await supabase
    .from("tz_checks")
    .select(
      "id, check_number, bank_name, bounce_risk, cash_events:tz_cash_events(id, amount, due_date, status, vendors:tz_vendors(name))"
    )
    .order("created_at", { ascending: false });

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Pashkovsky Group · Tazrim
        </div>
        <h1 className="mb-4 text-2xl font-bold">שיקים</h1>

        <NavTabs active="/app/admin/tazrim/checks" />

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
            action={addCheck}
            className="mb-8 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="text-sm font-semibold">הוספת שיק</div>
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
                min="0"
                required
                placeholder="סכום (₪)"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <input
                name="due_date"
                type="date"
                required
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <input
                name="check_number"
                placeholder="מספר שיק"
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <input
                name="bank_name"
                placeholder="בנק"
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
          {!checks || checks.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">עדיין אין שיקים.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                  <th className="px-5 py-3 font-medium">ספק</th>
                  <th className="px-5 py-3 font-medium">סכום</th>
                  <th className="px-5 py-3 font-medium">תאריך פירעון</th>
                  <th className="px-5 py-3 font-medium">מספר שיק</th>
                  <th className="px-5 py-3 font-medium">בנק</th>
                  <th className="px-5 py-3 font-medium">סטטוס</th>
                  <th className="px-5 py-3 font-medium">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => {
                  const ce = c.cash_events as unknown as {
                    amount: number;
                    due_date: string;
                    status: string;
                    vendors: { name: string } | null;
                  } | null;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-800 last:border-0"
                    >
                      <td className="px-5 py-3 font-medium">
                        {ce?.vendors?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {ce
                          ? `₪${Number(ce.amount).toLocaleString("he-IL")}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {ce?.due_date ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {c.check_number ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {c.bank_name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-zinc-400">
                        {ce?.status ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-left">
                        <DeleteButton
                          id={c.id}
                          action={deleteCheck}
                          confirmMessage={`למחוק את השיק${
                            c.check_number ? ` מספר ${c.check_number}` : ""
                          }?`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
