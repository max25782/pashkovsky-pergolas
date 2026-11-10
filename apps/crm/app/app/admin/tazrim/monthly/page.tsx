import Link from "next/link";
import { requireTazrimAccess } from "@/lib/tazrim/guard";
import {
  loadCashPicture,
  loadRecurringMonth,
} from "@/lib/tazrim/load-cash-picture";
import {
  flowAmount,
  flowTitle,
  projectBalance,
  summarizeRisk,
  variableFlows,
  type CashFlowItem,
  type ProjectionDay,
} from "@/lib/tazrim/cash-flow";
import {
  addDays,
  formatFullDate,
  formatMoney,
  formatMonthYear,
  formatShortDate,
  formatSignedMoney,
  hebrewDayName,
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

const PERIOD_DAYS = 30;
const BUCKET_DAYS = 7;
const EMPTY_TEXT = "אין נתונים עדיין";

interface WeekBucket {
  from: string;
  to: string;
  income: number;
  expense: number;
  endBalance: number | null;
}

interface TypeTotal {
  typeLabel: string;
  total: number;
  count: number;
}

function bucketWeeks(
  periodStart: string,
  periodEnd: string,
  days: ProjectionDay[],
  flows: CashFlowItem[]
): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let from = periodStart; from <= periodEnd; from = addDays(from, BUCKET_DAYS)) {
    const candidateEnd = addDays(from, BUCKET_DAYS - 1);
    const to = candidateEnd > periodEnd ? periodEnd : candidateEnd;
    const inRange = flows.filter((f) => f.date >= from && f.date <= to);
    buckets.push({
      from,
      to,
      income: inRange
        .filter((f) => f.direction === "in")
        .reduce((t, f) => t + (f.amount ?? 0), 0),
      expense: inRange
        .filter((f) => f.direction === "out")
        .reduce((t, f) => t + (f.amount ?? 0), 0),
      endBalance: days.find((d) => d.date === to)?.balance ?? null,
    });
  }
  return buckets;
}

function totalsByType(expenses: CashFlowItem[]): TypeTotal[] {
  const map = new Map<string, TypeTotal>();
  for (const f of expenses) {
    const entry = map.get(f.typeLabel) ?? {
      typeLabel: f.typeLabel,
      total: 0,
      count: 0,
    };
    entry.total += f.amount ?? 0;
    entry.count += 1;
    map.set(f.typeLabel, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export default async function MonthlyCashFlowPage() {
  const { supabase } = await requireTazrimAccess();

  const today = todayInIsrael();
  const periodEnd = addDays(today, PERIOD_DAYS - 1);

  const [picture, recurringMonth] = await Promise.all([
    loadCashPicture(supabase, today, PERIOD_DAYS),
    loadRecurringMonth(supabase, today),
  ]);
  const { totalBalance } = picture;

  const flows = picture.flows.filter((f) => f.date <= periodEnd);
  const expenses = flows.filter((f) => f.direction === "out");
  const variableExpenses = variableFlows(expenses);
  const income = flows.filter((f) => f.direction === "in");
  const expenseTotal = expenses.reduce((t, f) => t + (f.amount ?? 0), 0);
  const incomeTotal = income.reduce((t, f) => t + (f.amount ?? 0), 0);

  const days =
    totalBalance === null
      ? []
      : projectBalance(totalBalance, flows, today, periodEnd);
  const endBalance = days.at(-1)?.balance ?? null;
  const risk = totalBalance === null ? null : summarizeRisk(totalBalance, days);
  const riskStyle = risk ? RISK_STYLES[risk.level] : null;

  const allErrors = [...picture.errors, ...recurringMonth.errors];
  const weeks = bucketWeeks(today, periodEnd, days, flows);
  const byType = totalsByType(expenses);
  const activeDays = days.filter((d) => d.income > 0 || d.expense > 0);

  const lowDayExpenses = risk
    ? expenses.filter((f) => f.date === risk.minDate)
    : [];
  const nextIncome = risk ? income.find((f) => f.date > risk.minDate) : undefined;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 pb-24 pt-5 md:gap-[26px] md:px-14 md:pt-12">
        <PageHeader
          title={`תזרים חודשי · ${formatFullDate(today)}`}
          mobileTitle="תזרים חודשי"
          subtitle={`${PERIOD_DAYS} הימים הקרובים: ${formatShortDate(today)} – ${formatShortDate(periodEnd)}`}
        >
          <BackLink href="/app/admin/tazrim">← חזרה למסך היומי</BackLink>
        </PageHeader>

        <NavTabs active="/app/admin/tazrim/monthly" />

        {allErrors.length > 0 && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            חלק מהנתונים לא נטענו: {allErrors.join(" · ")}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-[18px]">
          {totalBalance === null ? (
            <Link
              href="/app/admin/tazrim/balance"
              className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 hover:bg-amber-500/[0.15] md:px-6 md:py-[22px]"
            >
              <div className="text-[13px] text-zinc-400">יתרה נוכחית</div>
              <div className="text-base font-bold text-amber-500">
                הזן יתרת בנק כדי לראות תחזית ←
              </div>
            </Link>
          ) : (
            <Card className="flex flex-col gap-2">
              <div className="text-[13px] text-zinc-400">יתרה נוכחית</div>
              <div className="text-[28px] font-extrabold text-amber-500">
                {formatMoney(totalBalance)}
              </div>
            </Card>
          )}
          <Card className="flex flex-col gap-2">
            <div className="text-[13px] text-zinc-400">צפי הכנסות</div>
            <div className="text-[28px] font-extrabold text-emerald-400">
              {formatMoney(incomeTotal)}
            </div>
          </Card>
          <Card className="flex flex-col gap-2">
            <div className="text-[13px] text-zinc-400">הוצאות מתוכננות</div>
            <div className="text-[28px] font-extrabold text-zinc-100">
              {formatMoney(expenseTotal)}
            </div>
          </Card>
          {endBalance !== null && (
            <Card className="flex flex-col gap-2">
              <div className="text-[13px] text-zinc-400">
                יתרה צפויה בסוף התקופה
              </div>
              <div
                className={`text-[28px] font-extrabold ${endBalance < 0 ? "text-red-400" : "text-emerald-400"}`}
              >
                {formatMoney(endBalance)}
              </div>
            </Card>
          )}
        </div>

        {variableExpenses.length > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-[22px] py-[14px] text-[13.5px] leading-[1.6] text-zinc-300">
            לא נכלל בסכום ההוצאות (סכום משתנה):{" "}
            {variableExpenses
              .map(
                (f) =>
                  `${flowTitle(f)} · ${formatShortDate(f.date)} (${flowAmount(f)})`
              )
              .join(", ")}
          </div>
        )}

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
                : "אין הכנסה צפויה אחרי הנקודה הנמוכה בתקופה."}
            </div>
          </div>
        )}

        {/* Week by week */}
        <Card className="flex flex-col gap-3.5">
          <div className="text-base font-bold">תזרים שבוע אחר שבוע</div>
          {flows.length === 0 && totalBalance === null ? (
            <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-right text-[12.5px] text-zinc-400">
                  <th className="py-1.5 font-medium">תקופה</th>
                  <th className="py-1.5 font-medium">הכנסות</th>
                  <th className="py-1.5 font-medium">הוצאות</th>
                  <th className="py-1.5 font-medium">יתרה בסוף התקופה</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((w) => (
                  <tr key={w.from} className="border-t border-zinc-800">
                    <td className="py-2.5 text-sm text-zinc-300">
                      {formatShortDate(w.from)} – {formatShortDate(w.to)}
                    </td>
                    <td className="py-2.5 text-sm text-emerald-400">
                      {w.income > 0 ? formatSignedMoney(w.income) : "—"}
                    </td>
                    <td className="py-2.5 text-sm text-warn">
                      {w.expense > 0 ? formatSignedMoney(-w.expense) : "—"}
                    </td>
                    <td
                      className={`py-2.5 text-sm font-bold ${
                        w.endBalance !== null && w.endBalance < 0
                          ? "text-red-400"
                          : "text-zinc-100"
                      }`}
                    >
                      {w.endBalance === null ? "—" : formatMoney(w.endBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Days with movement */}
        <Card className="flex flex-col gap-3.5">
          <div className="text-base font-bold">ימים עם תנועות</div>
          {totalBalance === null ? (
            <div className="text-sm text-zinc-500">
              הזן יתרת בנק כדי לראות יתרה יומית
            </div>
          ) : activeDays.length === 0 ? (
            <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
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
                {activeDays.map((d) => (
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

        {/* By type + income */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card className="flex flex-col gap-3.5">
            <div className="text-base font-bold">הוצאות החודש · לפי סוג</div>
            {byType.length === 0 ? (
              <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {byType.map((t) => (
                    <tr key={t.typeLabel} className="border-t border-zinc-800">
                      <td className="py-2.5 text-sm text-zinc-300">
                        {t.typeLabel}
                        <span className="mr-2 text-xs text-zinc-600">
                          {t.count} תשלומים
                        </span>
                      </td>
                      <td className="py-2.5 text-left text-sm font-semibold text-zinc-100">
                        {formatMoney(t.total)}
                      </td>
                      <td className="w-14 py-2.5 text-left text-xs text-zinc-400">
                        {expenseTotal > 0
                          ? `${Math.round((t.total / expenseTotal) * 100)}%`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card className="flex flex-col gap-3.5">
            <div className="text-base font-bold">הכנסות צפויות החודש</div>
            {income.length === 0 ? (
              <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {income.map((f) => (
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

        {/* Recurring charges of the whole calendar month, past days included */}
        <Card className="flex flex-col gap-3.5">
          <div className="text-base font-bold">
            חיובים קבועים · {formatMonthYear(today)}
          </div>
          {recurringMonth.flows.length === 0 ? (
            <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
          ) : (
            <table className="w-full">
              <tbody>
                {recurringMonth.flows.map((f) => (
                  <tr key={f.key} className="border-t border-zinc-800">
                    <td className="w-[70px] py-2.5 text-sm text-zinc-400">
                      {formatShortDate(f.date)}
                    </td>
                    <td className="py-2.5 text-sm text-zinc-300">
                      {flowTitle(f)}
                      {f.date < today && <Tag>עבר</Tag>}
                    </td>
                    <td className="py-2.5 text-left text-sm font-semibold text-zinc-100">
                      {flowAmount(f)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-700">
                  <td className="py-2.5 text-sm font-bold" colSpan={2}>
                    סך הכל חיובים בסכום ידוע
                  </td>
                  <td className="py-2.5 text-left text-sm font-extrabold text-zinc-100">
                    {formatMoney(recurringMonth.fixedTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {recurringMonth.variable.length > 0 && (
            <div className="text-[13px] text-amber-400">
              לא נכלל בסך הכל:{" "}
              {recurringMonth.variable
                .map((f) => `${flowTitle(f)} (${flowAmount(f)})`)
                .join(", ")}
            </div>
          )}
        </Card>

        {/* All expenses */}
        <Card className="flex flex-col gap-3.5">
          <div className="text-base font-bold">כל ההוצאות המתוכננות</div>
          {expenses.length === 0 ? (
            <div className="text-sm text-zinc-500">{EMPTY_TEXT}</div>
          ) : (
            <table className="w-full">
              <tbody>
                {expenses.map((f) => (
                  <tr
                    key={f.key}
                    className="border-t border-zinc-800 hover:bg-zinc-800/40"
                  >
                    <td className="w-[70px] p-0 text-sm text-zinc-400">
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
                    <td className="p-0 text-left text-sm font-semibold text-zinc-100">
                      <Link href={f.sourceHref} className="block py-2.5">
                        {flowAmount(f)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="text-center">
          <Link href="/app/admin/tazrim/weekly" className="text-[13px] text-zinc-600">
            תזרים שבועי ←
          </Link>
        </div>
      </div>
    </div>
  );
}
