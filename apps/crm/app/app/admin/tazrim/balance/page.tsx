import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { getAccountBalances } from "@/lib/tazrim/bank-balances";
import { formatFullDate, formatSignedMoney } from "@/lib/tazrim/format";
import { addBankAccount, setBalance, setCrmDefaultAccount } from "./actions";
import { NavTabs } from "../components/NavTabs";

function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₪${Math.abs(value).toLocaleString("he-IL")}`;
}

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function BalancePage() {
  const { supabase } = await requireTazrimAccess();
  const [{ accounts, error }, needsAccountResult] = await Promise.all([
    getAccountBalances(supabase),
    // Cleared CRM payments that could not be put on an account (no default
    // account, or not ILS); they stay out of every balance.
    supabase
      .from("tz_cash_events")
      .select("id", { count: "exact", head: true })
      .eq("type", "income")
      .eq("source", "alumincrm")
      .eq("status", "cleared")
      .eq("needs_account", true),
  ]);

  const needsAccountCount = needsAccountResult.count ?? 0;
  const hasCrmDefault = accounts.some((a) => a.isCrmDefault);

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Pashkovsky Group · Tazrim
        </div>
        <h1 className="mb-4 text-2xl font-bold">יתרת בנק</h1>

        <NavTabs active="/app/admin/tazrim/balance" />

        {error && (
          <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            חלק מהנתונים לא נטענו: {error}
          </div>
        )}

        {accounts.length > 0 && !hasCrmDefault && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-300"
          >
            לא נבחר חשבון ברירת מחדל לתשלומי AluminCRM. עד שייבחר, תשלומים
            מה-CRM לא ישפיעו על היתרה. בחר חשבון ברשימה למטה.
          </div>
        )}

        {needsAccountCount > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-300">
            {needsAccountCount} תשלומי CRM דורשים בחירת חשבון ואינם נכללים ביתרה
            (אין חשבון ברירת מחדל, או שהתשלום לא בשקלים).
          </div>
        )}

        <form
          action={addBankAccount}
          className="mb-8 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="text-sm font-semibold">הוספת חשבון בנק</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="label"
              required
              placeholder="שם החשבון (לדוגמה: עו״ש פועלים)"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
            <input
              name="purpose"
              placeholder="ייעוד (אופציונלי)"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="self-start rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
          >
            הוספה +
          </button>
        </form>

        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-500">
            עדיין אין חשבונות בנק — הוסף את הראשון למעלה.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.label}</div>
                    {a.purpose && (
                      <div className="text-xs text-zinc-500">{a.purpose}</div>
                    )}
                  </div>
                  <div className="text-left">
                    <div
                      className={`text-xl font-bold ${
                        a.balance === null
                          ? "text-zinc-500"
                          : a.balance < 0
                            ? "text-red-400"
                            : "text-amber-400"
                      }`}
                    >
                      {a.balance === null ? "אין נתון" : formatMoney(a.balance)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {a.snapshot_at
                        ? `עודכן: ${formatUpdatedAt(a.snapshot_at)}`
                        : "טרם עודכן"}
                    </div>
                  </div>
                </div>

                {a.snapshotBalance !== null && a.snapshotDate !== null && (
                  <div className="mt-3 text-xs text-zinc-400">
                    {`צילום ${formatMoney(a.snapshotBalance)} בתאריך ${formatFullDate(a.snapshotDate)}`}
                    {` + תשלומי CRM אחרי התאריך (${a.crmCount}) ${formatSignedMoney(a.crmTotal)}`}
                    {` = ${formatMoney(a.balance ?? a.snapshotBalance)}`}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {a.isCrmDefault ? (
                    <span className="rounded-full border border-emerald-800 bg-emerald-950/40 px-2.5 py-1 text-emerald-300">
                      חשבון ברירת מחדל לתשלומי CRM
                    </span>
                  ) : (
                    <form action={setCrmDefaultAccount}>
                      <input type="hidden" name="bank_account_id" value={a.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1 font-semibold text-zinc-300 hover:text-amber-400"
                      >
                        קבע כברירת מחדל לתשלומי CRM
                      </button>
                    </form>
                  )}
                </div>

                <form
                  action={setBalance}
                  className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4"
                >
                  <input type="hidden" name="bank_account_id" value={a.id} />
                  <input
                    name="balance"
                    type="number"
                    step="0.01"
                    required
                    placeholder="יתרה נוכחית (₪)"
                    aria-label="יתרה נוכחית"
                    className="w-44 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                  >
                    עדכון יתרה
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
