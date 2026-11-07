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
  formatFullDate,
  formatMoney,
  formatShortDate,
  formatSignedMoney,
  hebrewDayName,
  nextSunday,
  todayInIsrael,
} from "@/lib/tazrim/format";
import { NavTabs } from "../components/NavTabs";
import {
  BackLink,
  Card,
  PageHeader,
  RISK_STYLES,
  Tag,
} from "../components/dashboard-ui";
import Link from "next/link";

const EMPTY_TEXT = "אין נתונים עדיין";

export default async function WeeklyReportPage() {
  const { supabase } = await requireTazrimAccess();

  const today = todayInIsrael();
  const weekStart = nextSunday(today);
  const weekEnd = addDays(weekStart, 6);

  const picture = await loadCashPicture(supabase, today);
  const { totalBalance, flows } = picture;

  const weekFlows = flows.filter(
    (f) => f.date >= weekStart && f.date <= weekEnd
  );
  const weekExpenses = weekFlows.filter((f) => f.direction === "out");
  const weekIncome = weekFlows.filter((f) => f.direction === "in");
  const expenseTotal = sumFlows(flows, "out", weekStart, weekEnd);
  const incomeTotal = sumFlows(flows, "in", weekStart, weekEnd);

  // Balance is carried from today through the end of the report week; the
  // report itself only shows the week's own days.
  const allDays =
    totalBalance === null
      ? []
      : projectBalance(totalBalance, flows, today, weekEnd);
  const days = allDays.filter((d) => d.date >= weekStart);
  const weekOpening =
    totalBalance === null
      ? null
      : (allDays.filter((d) => d.date < weekStart).at(-1)?.balance ??
        totalBalance);
  const endBalance = days.at(-1)?.balance ?? null;
  const risk =
    weekOpening === null || days.length === 0
      ? null
      : summarizeRisk(weekOpening, days);
  const riskStyle = risk ? RISK_STYLES[risk.level] : null;

  const lowDayExpenses = risk
    ? weekExpenses.filter((f) => f.date === risk.minDate)
    : [];
  const nextIncome = risk
    ? weekIncome.find((f) => f.date > risk.minDate)
    : undefined;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pb-24 pt-5 md:gap-[26px] md:px-14 md:pt-12">
        <PageHeader
          title={`תזרים שבועי · יום ${hebrewDayName(today)} ${formatFullDate(today)}`}
          mobileTitle="תזרים שבועי"
          subtitle={`השבוע הבא: ${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`}
        >
          <BackLink href="/app/admin/tazrim">← חזרה למסך היומי</BackLink>
        </PageHeader>

        <NavTabs active="/app/admin/tazrim/weekly" />

        {picture.errors.length > 0 && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            חלק מהנתונים לא נטענו: {picture.errors.join(" · ")}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-[18px]">
          <Card className="flex flex-col gap-2">
            <div className="text-[13px] text-zinc-400">צפי הכנסות השבוע</div>
            <div className="text-[28px] font-extrabold text-emerald-400">
              {formatMoney(incomeTotal)}
            </div>
          </Card>
          <Card className="flex flex-col gap-2">
            <div className="text-[13px] text-zinc-400">הוצאות מתוכננות השבוע</div>
            <div className="text-[28px] font-extrabold text-zinc-100">
              {formatMoney(expenseTotal)}
            </div>
          </Card>
          {endBalance === null ? (
            <Link
              href="/app/admin/tazrim/balance"
              className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 hover:bg-amber-500/[0.15] md:px-6 md:py-[22px]"
            >
              <div className="text-[13px] text-zinc-400">
                יתרה צפויה בסוף השבוע
              </div>
              <div className="text-base font-bold text-amber-500">
                הזן יתרת בנק כדי לראות תחזית ←
              </div>
            </Link>
          ) : (
            <Card className="flex flex-col gap-2">
              <div className="text-[13px] text-zinc-400">
                יתרה צפויה בסוף השבוע
              </div>
              <div
                className={`text-[28px] font-extrabold ${endBalance < 0 ? "text-red-400" : "text-emerald-400"}`}
              >
                {formatMoney(endBalance)}
              </div>
            </Card>
          )}
        </div>

        {/* Risk callout */}
        {risk && riskStyle && risk.level !== "green" && (
          <div
            className={`flex flex-col gap-1.5 rounded-2xl border px-[22px] py-[18px] ${riskStyle.card}`}
          >
            <div className={`text-[14.5px] font-bold ${riskStyle.text}`}>
              ⚑ נקודת תזרים נמוכה: יום {hebrewDayName(risk.minDate)}{" "}
              {formatShortDate(risk.minDate)} — יתרה צפויה{" "}
              {formatMoney(risk.minBalance)}
            </div>
            <div className="text-[13.5px] leading-[1.6] text-zinc-300">
              {lowDayExpenses.length > 0 &&
                `באותו יום יוצאים: ${lowDayExpenses
                  .map((f) => `${flowTitle(f)} (${flowAmount(f)})`)
                  .join(", ")}. `}
              {nextIncome
                ? `ההכנסה הקרובה: ${flowTitle(nextIncome)} (${flowAmount(nextIncome)}) ב-${formatShortDate(nextIncome.date)}.`
                : "אין הכנסה צפויה אחרי הנקודה הנמוכה השבוע."}
            </div>
          </div>
        )}

        {/* Day by day */}
        <Card className="flex flex-col gap-3.5">
          <div className="text-base font-bold">יתרה יום אחר יום</div>
          {days.length === 0 ? (
            <div className="text-sm text-zinc-500">
              {totalBalance === null
                ? "הזן יתרת בנק כדי לראות יתרה יומית"
                : EMPTY_TEXT}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-right text-[12.5px] text-zinc-400">
                  <th className="py-1.5 font-medium">יום</th>
                  <th className="py-1.5 font-medium">הכנסות</th>
                  <th className="py-1.5 font-medium">הוצאות</th>
                  <th className="py-1.5 font-medium">יתרה מצטברת</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-t border-zinc-800">
                    <td className="py-2.5 text-sm text-zinc-300">
                      {hebrewDayName(d.date)} · {formatShortDate(d.date)}
                    </td>
                    <td className="py-2.5 text-sm text-emerald-400">
                      {d.income > 0 ? formatSignedMoney(d.income) : "—"}
                    </td>
                    <td className="py-2.5 text-sm text-warn">
                      {d.expense > 0 ? formatSignedMoney(-d.expense) : "—"}
                    </td>
                    <td
                      className={`py-2.5 text-sm font-bold ${d.balance < 0 ? "text-red-400" : "text-zinc-100"}`}
                    >
                      {formatMoney(d.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Expenses + income */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card className="flex flex-col gap-3.5">
            <div className="text-base font-bold">הוצאות השבוע · לפי סוג</div>
            {weekExpenses.length === 0 ? (
              <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {weekExpenses.map((f) => (
                    <tr key={f.key} className="border-t border-zinc-800">
                      <td className="w-[70px] py-2.5 text-sm text-zinc-400">
                        {formatShortDate(f.date)}
                      </td>
                      <td className="py-2.5 text-sm text-zinc-300">
                        <Link href={f.sourceHref}>{flowTitle(f)}</Link>
                        <Tag>{f.typeLabel}</Tag>
                      </td>
                      <td className="py-2.5 text-left text-sm font-semibold text-zinc-100">
                        {flowAmount(f)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card className="flex flex-col gap-3.5">
            <div className="text-base font-bold">הכנסות צפויות השבוע</div>
            {weekIncome.length === 0 ? (
              <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {weekIncome.map((f) => (
                    <tr key={f.key} className="border-t border-zinc-800">
                      <td className="w-[70px] py-2.5 text-sm text-zinc-400">
                        {formatShortDate(f.date)}
                      </td>
                      <td className="py-2.5 text-sm text-zinc-300">
                        {flowTitle(f)}
                      </td>
                      <td className="py-2.5 text-left text-sm font-semibold text-emerald-400">
                        {flowAmount(f)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="text-center">
          <Link href="/app/admin/tazrim/debts" className="text-[13px] text-zinc-600">
            מעקב חובות לספקים ←
          </Link>
        </div>
      </div>
    </div>
  );
}
