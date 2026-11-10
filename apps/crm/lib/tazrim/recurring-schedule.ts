import { addDays } from "@/lib/tazrim/format";

// Recurring charges are scheduled by frequency and payment day, NOT by the
// stored next_due_date. Nothing in the app advances that column (no cron, no
// payment confirmation, no bank reconciliation), so it only tells us the
// payment day (monthly) or the payment day and month (yearly). Every
// occurrence below is derived from that, so a stale date never drops a charge
// from a forecast. A rule has no start date: a charge first due in a later
// month would also be forecast in the months before it.

export interface ScheduledRule {
  frequency: string;
  next_due_date: string | null;
}

// Search horizon for "the next charge": a yearly charge is at most 366 days away.
const NEXT_OCCURRENCE_HORIZON_DAYS = 400;

interface YearMonth {
  year: number;
  month: number; // 1-12
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// The payment day clamped to the month length: day 31 charges on the 30th in
// November and on the 28th/29th in February.
function dateInMonth(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(Math.min(day, daysInMonth(year, month)))}`;
}

function monthsBetween(fromDate: string, toDate: string): YearMonth[] {
  const months: YearMonth[] = [];
  let year = Number(fromDate.slice(0, 4));
  let month = Number(fromDate.slice(5, 7));
  const endYear = Number(toDate.slice(0, 4));
  const endMonth = Number(toDate.slice(5, 7));
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

// Every charge date of the rule inside [fromDate, toDate] (inclusive), oldest
// first.
export function ruleOccurrences(
  rule: ScheduledRule,
  fromDate: string,
  toDate: string
): string[] {
  const anchor = rule.next_due_date;
  if (anchor === null || fromDate > toDate) return [];

  const anchorMonth = Number(anchor.slice(5, 7));
  const anchorDay = Number(anchor.slice(8, 10));

  let candidates: string[];
  if (rule.frequency === "monthly") {
    candidates = monthsBetween(fromDate, toDate).map(({ year, month }) =>
      dateInMonth(year, month, anchorDay)
    );
  } else if (rule.frequency === "yearly") {
    candidates = monthsBetween(fromDate, toDate)
      .filter(({ month }) => month === anchorMonth)
      .map(({ year, month }) => dateInMonth(year, month, anchorDay));
  } else {
    // Unknown frequency: the only date we can vouch for is the saved one.
    candidates = [anchor];
  }

  return candidates.filter((d) => d >= fromDate && d <= toDate);
}

// The next charge on or after `today`, for display. The stored date is not
// trusted for this because it is never advanced.
export function nextOccurrence(
  rule: ScheduledRule,
  today: string
): string | null {
  return (
    ruleOccurrences(
      rule,
      today,
      addDays(today, NEXT_OCCURRENCE_HORIZON_DAYS)
    )[0] ?? null
  );
}

// First and last day of the calendar month containing `isoDate`.
export function monthBounds(isoDate: string): { start: string; end: string } {
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  };
}
