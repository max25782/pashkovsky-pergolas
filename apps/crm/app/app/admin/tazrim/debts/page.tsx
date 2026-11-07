import Link from "next/link";
import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { loadCashPicture } from "@/lib/tazrim/load-cash-picture";
import { projectBalance, summarizeRisk } from "@/lib/tazrim/cash-flow";
import {
  addDays,
  formatMoney,
  formatShortDate,
  todayInIsrael,
} from "@/lib/tazrim/format";
import { recordDebtPayment, setOpeningDebt } from "./actions";
import { NavTabs } from "../components/NavTabs";
import {
  BackLink,
  Card,
  INPUT_CLASS,
  PageHeader,
} from "../components/dashboard-ui";

const WEEK_DAYS = 7;
const PAYMENT_STEP = 100;
const LAST_PAYMENTS_LOOKUP = 500;

interface LastPayment {
  date: string;
  amount: number;
}

export default async function DebtsPage() {
  const { supabase } = await requireTazrimAccess();
  const today = todayInIsrael();

  const [picture, vendorsResult, debtsResult, paymentsResult] =
    await Promise.all([
      loadCashPicture(supabase, today),
      supabase.from("tz_vendors").select("id, name").order("name"),
      supabase
        .from("tz_supplier_debts")
        .select("id, opening_balance, current_balance, vendors:tz_vendors(name)")
        .order("current_balance", { ascending: false }),
      supabase
        .from("tz_cash_events")
        .select("debt_id, amount, due_date")
        .not("debt_id", "is", null)
        .in("status", ["cleared", "planned"])
        .lte("due_date", today)
        .order("due_date", { ascending: false })
        .limit(LAST_PAYMENTS_LOOKUP),
    ]);

  const errors = [
    ...picture.errors,
    ...[vendorsResult.error, debtsResult.error, paymentsResult.error]
      .filter((e) => e !== null)
      .map((e) => e.message),
  ];

  const vendors = vendorsResult.data ?? [];
  // Many-to-one embeds come back as a single object at runtime; the untyped
  // client infers an array, so state the real shape explicitly.
  const debts = (debtsResult.data ?? []) as unknown as Array<{
    id: string;
    opening_balance: number;
    current_balance: number;
    vendors: { name: string } | null;
  }>;

  // Newest payment per debt (rows are already newest-first).
  const lastPayments = new Map<string, LastPayment>();
  for (const p of paymentsResult.data ?? []) {
    if (p.debt_id !== null && !lastPayments.has(p.debt_id)) {
      lastPayments.set(p.debt_id, {
        date: p.due_date,
        amount: Number(p.amount),
      });
    }
  }

  const totalDebt = debts.reduce((t, d) => t + Number(d.current_balance), 0);
  const paidDown = Math.max(
    0,
    debts.reduce((t, d) => t + Number(d.opening_balance), 0) - totalDebt
  );

  // Cash that can go to debts this week without dipping into the risk zone.
  const { totalBalance, flows } = picture;
  let freeCash = 0;
  if (totalBalance !== null) {
    const days = projectBalance(
      totalBalance,
      flows,
      today,
      addDays(today, WEEK_DAYS)
    );
    const risk = summarizeRisk(totalBalance, days);
    freeCash =
      Math.floor(Math.max(0, risk.minBalance - risk.riskLine) / PAYMENT_STEP) *
      PAYMENT_STEP;
  }

  // Largest debts get the free cash first.
  let remaining = freeCash;
  const suggestions = new Map<string, number>();
  for (const d of debts) {
    const owed = Number(d.current_balance);
    if (owed <= 0 || remaining <= 0) continue;
    const pay = Math.min(owed, remaining);
    suggestions.set(d.id, pay);
    remaining -= pay;
  }
  const topSuggestion = debts.find((d) => suggestions.has(d.id));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pb-24 pt-5 md:px-14 md:pt-12">
        <PageHeader
          title="מעקב חובות לספקים"
          subtitle="חוב פתוח שרץ בחשבון — בלי שיקים"
        >
          <BackLink href="/app/admin/tazrim">← חזרה למסך היומי</BackLink>
        </PageHeader>

        <NavTabs active="/app/admin/tazrim/debts" />

        {errors.length > 0 && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            חלק מהנתונים לא נטענו: {errors.join(" · ")}
          </div>
        )}

        {/* Total */}
        <Card className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="text-[13px] text-zinc-400">סך חובות פתוחים כרגע</div>
            <div className="text-4xl font-extrabold">{formatMoney(totalDebt)}</div>
          </div>
          {paidDown > 0 && (
            <div className="text-sm font-semibold text-emerald-400">
              ↓ {formatMoney(paidDown)} שולמו מתחילת המעקב
            </div>
          )}
        </Card>

        {/* Free cash suggestion */}
        {topSuggestion && freeCash > 0 && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-400/[0.35] bg-emerald-400/10 px-[22px] py-[18px]">
            <div className="text-[14.5px] font-bold text-emerald-400">
              💰 יש {formatMoney(freeCash)} פנויים השבוע לכיסוי חוב
            </div>
            <div className="text-[13.5px] leading-[1.6] text-zinc-300">
              לפי היתרה הצפויה, אפשר לשלם{" "}
              {formatMoney(suggestions.get(topSuggestion.id) ?? 0)} מתוך החוב
              ל&quot;{topSuggestion.vendors?.name ?? "—"}&quot; בלי לרדת מתחת
              לרף הבטיחות. התשלום לא יפגע בהוצאות המתוכננות השבוע.
            </div>
          </div>
        )}
        {totalBalance === null && debts.length > 0 && (
          <Link
            href="/app/admin/tazrim/balance"
            className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-[22px] py-[18px] text-sm font-semibold text-amber-500 hover:bg-amber-500/[0.15]"
          >
            הזן יתרת בנק כדי לקבל המלצת תשלום ←
          </Link>
        )}

        {/* Per supplier */}
        <Card className="flex flex-col gap-3.5">
          <div className="text-base font-bold">חוב לפי ספק</div>
          {debts.length === 0 ? (
            <div className="text-sm text-zinc-500">עדיין אין חובות.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-right text-[12.5px] text-zinc-400">
                  <th className="py-1.5 font-medium">ספק</th>
                  <th className="py-1.5 font-medium">חוב פתוח</th>
                  <th className="py-1.5 font-medium">תשלום אחרון</th>
                  <th className="py-1.5 font-medium">המלצה</th>
                  <th className="py-1.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => {
                  const owed = Number(d.current_balance);
                  const last = lastPayments.get(d.id);
                  const suggested = suggestions.get(d.id);
                  return (
                    <tr key={d.id} className="border-t border-zinc-800 align-top">
                      <td className="py-3 text-sm font-semibold">
                        {d.vendors?.name ?? "—"}
                      </td>
                      <td
                        className={`py-3 text-sm ${owed > 0 ? "text-zinc-300" : "text-emerald-400"}`}
                      >
                        {formatMoney(owed)}
                      </td>
                      <td className="py-3 text-[13px] text-zinc-400">
                        {last
                          ? `${formatShortDate(last.date)} · ${formatMoney(last.amount)}`
                          : "—"}
                      </td>
                      <td className="py-3 text-[13px] text-emerald-400">
                        {owed <= 0
                          ? "שולם במלואו"
                          : suggested !== undefined
                            ? `לשלם ${formatMoney(suggested)} השבוע`
                            : totalBalance === null
                              ? "—"
                              : "להמתין"}
                      </td>
                      <td className="py-3 text-left">
                        {owed > 0 && (
                          <details className="group">
                            <summary className="inline-block cursor-pointer list-none rounded-lg border border-zinc-800 bg-zinc-950 px-3.5 py-[7px] text-[12.5px] font-semibold text-amber-500 group-open:hidden">
                              דיווח תשלום
                            </summary>
                            <form
                              action={recordDebtPayment}
                              className="flex flex-wrap items-center justify-end gap-2"
                            >
                              <input type="hidden" name="debt_id" value={d.id} />
                              <input
                                name="amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                defaultValue={suggested}
                                placeholder="סכום (₪)"
                                aria-label="סכום תשלום"
                                className={`${INPUT_CLASS} w-32 !py-1.5`}
                              />
                              <input
                                name="payment_date"
                                type="date"
                                required
                                defaultValue={today}
                                aria-label="תאריך תשלום"
                                className={`${INPUT_CLASS} !py-1.5`}
                              />
                              <button
                                type="submit"
                                className="rounded-lg bg-amber-500 px-3.5 py-[7px] text-[12.5px] font-bold text-[#1a1304] hover:bg-amber-400"
                              >
                                רישום תשלום
                              </button>
                            </form>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* Set opening debt */}
        {vendors.length === 0 ? (
          <Card className="text-sm text-zinc-400">
            קודם צריך להוסיף ספק אחד לפחות בעמוד{" "}
            <Link href="/app/admin/tazrim/vendors" className="text-amber-400 underline">
              ספקים
            </Link>
            .
          </Card>
        ) : (
          <Card>
            <form action={setOpeningDebt} className="flex flex-col gap-3">
              <div className="text-sm font-semibold">הוספת/עדכון חוב פתוח</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  name="vendor_id"
                  required
                  defaultValue=""
                  className={INPUT_CLASS}
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
                  placeholder="סכום החוב (₪)"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="text-xs text-zinc-500">
                אם כבר קיים חוב לספק, יתרת הפתיחה והיתרה הנוכחית יוחלפו בסכום
                החדש.
              </div>
              <button
                type="submit"
                className="self-start rounded-[10px] bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#1a1304] hover:bg-amber-400"
              >
                שמירה
              </button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
