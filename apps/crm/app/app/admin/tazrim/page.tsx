import Link from "next/link";
import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { loadCashPicture } from "@/lib/tazrim/load-cash-picture";
import {
  flowAmount,
  flowTitle,
  projectBalance,
  summarizeRisk,
  sumFlows,
} from "@/lib/tazrim/cash-flow";
import {
  addDays,
  formatLongDate,
  formatMoney,
  formatShortDate,
  formatSignedMoney,
  formatFullDate,
  formatUpdatedAt,
  hebrewDayName,
  todayInIsrael,
} from "@/lib/tazrim/format";
import { addQuickExpense } from "./expenses/actions";
import { NavTabs } from "./components/NavTabs";
import {
  Card,
  INPUT_CLASS,
  PageHeader,
  RISK_STYLES,
  StatCard,
  StatusChip,
  Tag,
} from "./components/dashboard-ui";

const WEEK_DAYS = 7;
const LIST_DAYS = 14;
const EMPTY_TEXT = "אין נתונים עדיין";

const QUICK_CATEGORIES = [
  "חומרי גלם",
  "שכר עבודה",
  "קבלני משנה",
  "כרטיס אשראי",
  "שיווק — סוכנות",
  "שיווק — פלטפורמות",
  "דלק / רכב",
  "ביטוחים",
  "הוצאה בלתי צפויה",
  "אחר",
];

const QUICK_MEANS = [
  { value: "bank_transfer", label: "מזומן / העברה" },
  { value: "card", label: "כרטיס אשראי" },
  { value: "check", label: "שיק" },
];

function daysBetween(fromDate: string, toDate: string): number {
  const ms =
    new Date(`${toDate}T00:00:00Z`).getTime() -
    new Date(`${fromDate}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export default async function DashboardPage() {
  const { supabase } = await requireTazrimAccess();

  const today = todayInIsrael();
  const weekEnd = addDays(today, WEEK_DAYS);
  const listEnd = addDays(today, LIST_DAYS);

  const [picture, debtsResult] = await Promise.all([
    loadCashPicture(supabase, today),
    supabase.from("tz_supplier_debts").select("opening_balance, current_balance"),
  ]);

  const errors = [
    ...picture.errors,
    ...(debtsResult.error ? [debtsResult.error.message] : []),
  ];

  const { totalBalance, flows } = picture;

  const weekDays =
    totalBalance === null
      ? []
      : projectBalance(totalBalance, flows, today, weekEnd);
  const risk =
    totalBalance === null ? null : summarizeRisk(totalBalance, weekDays);
  const riskStyle = risk ? RISK_STYLES[risk.level] : null;

  const riskDates = new Set(
    risk && risk.level !== "green"
      ? weekDays.filter((d) => d.balance < risk.riskLine).map((d) => d.date)
      : []
  );

  const weekExpenses = sumFlows(flows, "out", today, weekEnd);
  const upcomingExpenses = flows.filter(
    (f) => f.direction === "out" && f.date <= listEnd
  );
  const upcomingIncome = flows.filter(
    (f) => f.direction === "in" && f.date <= listEnd
  );

  const todayNet = picture.today.income - picture.today.expense;
  const endOfToday = weekDays[0]?.balance ?? null;

  const debts = debtsResult.data ?? [];
  const totalDebt = debts.reduce((t, d) => t + Number(d.current_balance), 0);
  const paidDown = Math.max(
    0,
    debts.reduce((t, d) => t + Number(d.opening_balance), 0) - totalDebt
  );

  const riskChipText =
    risk === null
      ? null
      : risk.riskStartDate === null
        ? "אין סיכון ב-7 ימים"
        : daysBetween(today, risk.riskStartDate) === 0
          ? "סיכון היום"
          : `סיכון בעוד ${daysBetween(today, risk.riskStartDate)} ימים`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile quick-add bar */}
      <form
        action={addQuickExpense}
        className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-zinc-800 bg-zinc-900 px-4 py-3 md:hidden"
      >
        <input type="hidden" name="category" value="אחר" />
        <input type="hidden" name="means" value="bank_transfer" />
        <input
          name="description"
          required
          placeholder="הוצאה מהירה…"
          className={`${INPUT_CLASS} min-w-0 flex-1`}
        />
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="₪"
          aria-label="סכום"
          className={`${INPUT_CLASS} w-[70px] px-2.5`}
        />
        <button
          type="submit"
          className="rounded-[10px] bg-amber-500 px-[18px] py-[11px] text-sm font-bold text-[#1a1304]"
        >
          +
        </button>
      </form>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 pb-28 pt-5 md:gap-6 md:px-14 md:pb-24 md:pt-12">
        <PageHeader
          title="תזרים — מסך יומי"
          mobileTitle="תזרים — היום"
          subtitle={formatLongDate(today)}
          mobileSubtitle={`יום ${hebrewDayName(today)}, ${Number(today.slice(8))}.${Number(today.slice(5, 7))}.${today.slice(0, 4)}`}
        >
          <div className="flex w-full items-center gap-2 overflow-x-auto md:w-auto md:gap-2.5 md:overflow-visible">
            {picture.lastUpdatedAt ? (
              <StatusChip
                href="/app/admin/tazrim/balance"
                dotClassName="bg-emerald-400"
                className="border-zinc-800 bg-zinc-900 text-zinc-300"
              >
                יתרה עודכנה {formatUpdatedAt(picture.lastUpdatedAt, today)}
              </StatusChip>
            ) : (
              <StatusChip
                href="/app/admin/tazrim/balance"
                dotClassName="bg-zinc-600"
                className="border-zinc-800 bg-zinc-900 text-zinc-300"
              >
                אין יתרת בנק
              </StatusChip>
            )}
            {riskChipText && risk && (
              <StatusChip
                dotClassName={RISK_STYLES[risk.level].dot}
                className={`font-semibold ${RISK_STYLES[risk.level].chip}`}
              >
                {riskChipText}
              </StatusChip>
            )}
          </div>
        </PageHeader>

        <NavTabs active="/app/admin/tazrim" />

        {errors.length > 0 && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            חלק מהנתונים לא נטענו: {errors.join(" · ")}
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-[18px]">
          {totalBalance === null || risk === null || riskStyle === null ? (
            <Link
              href="/app/admin/tazrim/balance"
              className="col-span-2 flex flex-col justify-center gap-1 rounded-[14px] border border-amber-500/40 bg-amber-500/10 p-4 hover:bg-amber-500/[0.15] md:rounded-2xl md:px-6 md:py-[22px]"
            >
              <div className="text-lg font-bold text-amber-500">
                הזן יתרת בנק כדי לראות תחזית
              </div>
              <div className="text-xs text-zinc-400 md:text-[12.5px]">
                יתרה נוכחית ונקודה נמוכה ל-7 ימים יחושבו אחרי עדכון היתרה ←
              </div>
            </Link>
          ) : (
            <StatCard
              labelShort="יתרה היום"
              labelLong="יתרה בחשבון היום"
              value={formatMoney(totalBalance)}
              note="מתעדכן ידנית ב״יתרת בנק״"
              className="order-1"
            />
          )}

          <StatCard
            labelShort="תזרים היום"
            value={formatSignedMoney(todayNet)}
            valueClassName={
              todayNet > 0
                ? "text-emerald-400"
                : todayNet < 0
                  ? "text-warn"
                  : "text-zinc-100"
            }
            note={`${picture.today.incomeCount} הכנסות · ${picture.today.expenseCount} הוצאות`}
            className="order-2"
          />

          {risk !== null && riskStyle !== null && (
            <StatCard
              labelShort="נקודה נמוכה · 7י"
              labelLong="נקודה נמוכה · 7 ימים קדימה"
              value={formatMoney(risk.minBalance)}
              valueClassName={riskStyle.text}
              note={`ביום ${hebrewDayName(risk.minDate)} ${formatShortDate(risk.minDate)}`}
              className={`order-3 ${riskStyle.card}`}
            />
          )}

          <StatCard
            labelShort="הוצאות השבוע"
            labelLong="כל ההוצאות השבוע"
            value={formatMoney(weekExpenses)}
            note="שיקים · כרטיסים · הוראות קבע · מזומן"
            className="order-4"
          />
        </div>

        {/* Quick add (desktop) */}
        <Card className="hidden flex-col gap-3.5 md:flex">
          <div className="flex items-center justify-between">
            <div className="text-base font-bold">הוספת הוצאה מהירה</div>
            <div className="text-[12.5px] text-zinc-600">
              פחות מ-3 שניות · נכנס מיד לדוח היומי
            </div>
          </div>
          <form action={addQuickExpense} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-12 items-end gap-3">
              <label className="col-span-4 flex flex-col gap-1.5 text-[12.5px] text-zinc-400">
                תיאור
                <input
                  name="description"
                  required
                  placeholder="למשל: דלק למשאית"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1.5 text-[12.5px] text-zinc-400">
                סכום (₪)
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="col-span-3 flex flex-col gap-1.5 text-[12.5px] text-zinc-400">
                קטגוריה
                <select name="category" defaultValue="חומרי גלם" className={INPUT_CLASS}>
                  {QUICK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-3 flex flex-col gap-1.5 text-[12.5px] text-zinc-400">
                אמצעי
                <select name="means" defaultValue="bank_transfer" className={INPUT_CLASS}>
                  {QUICK_MEANS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              className="self-end rounded-[10px] bg-amber-500 px-7 py-3 text-sm font-bold text-[#1a1304] hover:bg-amber-400"
            >
              הוספה +
            </button>
          </form>
        </Card>

        {/* Upcoming expenses + expected income */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          <Card className="flex flex-col gap-2.5 md:gap-3.5">
            <div className="text-sm font-bold md:text-base">
              <span className="md:hidden">הוצאות קרובות</span>
              <span className="hidden md:inline">
                הוצאות קרובות · {LIST_DAYS} הימים הבאים
              </span>
            </div>
            {upcomingExpenses.length === 0 ? (
              <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
            ) : (
              <>
                <table className="hidden w-full md:table">
                  <thead>
                    <tr className="text-right text-[12.5px] text-zinc-400">
                      <th className="py-1.5 font-medium">תאריך</th>
                      <th className="py-1.5 font-medium">למי / מה</th>
                      <th className="py-1.5 font-medium">סכום</th>
                      <th className="py-1.5 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingExpenses.map((f) => (
                      <tr
                        key={f.key}
                        className="border-t border-zinc-800 hover:bg-zinc-800/40"
                      >
                        <td className="whitespace-nowrap p-0 text-sm text-zinc-300">
                          <Link href={f.sourceHref} className="block py-2.5">
                            {formatShortDate(f.date)}
                          </Link>
                        </td>
                        <td className="p-0 text-sm text-zinc-300">
                          <Link href={f.sourceHref} className="block py-2.5">
                            {flowTitle(f)}
                            <Tag>{f.typeLabel}</Tag>
                          </Link>
                        </td>
                        <td className="whitespace-nowrap p-0 text-sm font-semibold text-zinc-100">
                          <Link href={f.sourceHref} className="block py-2.5">
                            {flowAmount(f)}
                          </Link>
                        </td>
                        <td className="p-0 text-xs text-warn">
                          <Link href={f.sourceHref} className="block py-2.5">
                            {riskDates.has(f.date) ? "⚑" : ""}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  {upcomingExpenses.map((f) => (
                    <li key={f.key} className="border-t border-zinc-800">
                      <Link
                        href={f.sourceHref}
                        className="flex items-center justify-between py-[9px]"
                      >
                        <div className="flex flex-col gap-[3px]">
                          <div className="text-[13.5px] text-zinc-100">
                            {flowTitle(f)}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11.5px] text-zinc-400">
                              {formatShortDate(f.date)}
                            </span>
                            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10.5px] text-zinc-400">
                              {f.typeLabel}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {riskDates.has(f.date) && (
                            <span className="text-xs text-warn">⚑</span>
                          )}
                          <span className="whitespace-nowrap text-sm font-bold text-zinc-100">
                            {flowAmount(f)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-2.5 md:gap-3.5">
            <div className="text-sm font-bold md:text-base">הכנסות צפויות</div>
            {upcomingIncome.length === 0 ? (
              <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
            ) : (
              <>
                <table className="hidden w-full md:table">
                  <thead>
                    <tr className="text-right text-[12.5px] text-zinc-400">
                      <th className="py-1.5 font-medium">מקור</th>
                      <th className="py-1.5 font-medium">תאריך צפוי</th>
                      <th className="py-1.5 font-medium">סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingIncome.map((f) => (
                      <tr key={f.key} className="border-t border-zinc-800">
                        <td className="py-2.5 text-sm text-zinc-300">
                          {flowTitle(f)}
                        </td>
                        <td className="py-2.5 text-sm text-zinc-300">
                          {formatShortDate(f.date)}
                        </td>
                        <td className="py-2.5 text-sm font-semibold text-emerald-400">
                          {flowAmount(f)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="md:hidden">
                  {upcomingIncome.map((f) => (
                    <li
                      key={f.key}
                      className="flex items-center justify-between border-t border-zinc-800 py-[9px]"
                    >
                      <div className="flex flex-col gap-[3px]">
                        <div className="text-[13.5px] text-zinc-100">
                          {flowTitle(f)}
                        </div>
                        <div className="text-[11.5px] text-zinc-400">
                          {formatShortDate(f.date)}
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-sm font-bold text-emerald-400">
                        {flowAmount(f)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>

        {/* Debts */}
        <Link href="/app/admin/tazrim/debts" className="md:hidden">
          <Card className="flex items-center justify-between">
            <div>
              <div className="text-[11.5px] text-zinc-400">חובות פתוחים</div>
              <div className="text-[20px] font-extrabold">
                {formatMoney(totalDebt)}
              </div>
            </div>
            <div className="text-[13px] font-semibold text-amber-500">מעקב ←</div>
          </Card>
        </Link>
        <Card className="hidden flex-wrap items-center justify-between gap-4 md:flex">
          <div className="flex flex-wrap items-center gap-5">
            <div>
              <div className="text-[13px] text-zinc-400">חובות פתוחים לספקים</div>
              <div className="text-[26px] font-extrabold">
                {formatMoney(totalDebt)}
              </div>
            </div>
            {paidDown > 0 && (
              <div className="text-[13.5px] text-emerald-400">
                ↓ {formatMoney(paidDown)} שולמו מתחילת המעקב
              </div>
            )}
          </div>
          <Link
            href="/app/admin/tazrim/debts"
            className="rounded-[10px] border border-zinc-800 bg-zinc-950 px-[18px] py-2.5 text-sm font-semibold text-amber-500 hover:text-amber-400"
          >
            מעקב חובות מלא ←
          </Link>
        </Card>

        {/* Daily report */}
        <Link href="/app/admin/tazrim/weekly" className="md:hidden">
          <Card className="flex items-center justify-between">
            <div className="text-sm font-bold">תזרים שבועי</div>
            <div className="text-[13px] font-semibold text-amber-500">פתח ←</div>
          </Card>
        </Link>
        <Card className="hidden flex-col gap-2.5 md:flex">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base font-bold">
              דוח יומי · {formatFullDate(today)}
            </div>
            <Link
              href="/app/admin/tazrim/weekly"
              className="rounded-[10px] border border-zinc-800 bg-zinc-950 px-[18px] py-2.5 text-sm font-semibold text-amber-500 hover:text-amber-400"
            >
              תזרים שבועי ←
            </Link>
          </div>
          <div className="text-[14.5px] leading-[1.7] text-zinc-300">
            {picture.today.incomeCount === 0
              ? "לא נכנסו הכנסות"
              : `נכנסו ${formatMoney(picture.today.income)} מ-${picture.today.incomeCount} הכנסות`}
            {picture.today.expenseCount === 0
              ? ", לא יצאו הוצאות"
              : `, יצאו ${formatMoney(picture.today.expense)} מ-${picture.today.expenseCount} הוצאות`}
            .
            {endOfToday !== null &&
              ` יתרה צפויה בסוף היום: ${formatMoney(endOfToday)}.`}
          </div>
          {risk && riskStyle && risk.level !== "green" && (
            <div
              className={`rounded-[10px] px-3.5 py-2.5 text-[13.5px] leading-[1.6] ${riskStyle.card} ${riskStyle.text}`}
            >
              ⚑ נקודת תזרים נמוכה ביום {hebrewDayName(risk.minDate)}{" "}
              {formatShortDate(risk.minDate)} — יתרה צפויה{" "}
              {formatMoney(risk.minBalance)}.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
