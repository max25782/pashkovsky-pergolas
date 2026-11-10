const TIME_ZONE = "Asia/Jerusalem";
const LRM = "\u200E";

// Today in Israel time as YYYY-MM-DD (due_date columns are plain dates).
export function todayInIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date()
  );
}

// Calendar date (YYYY-MM-DD) in Israel time of any timestamp, e.g. the day a
// bank balance snapshot was taken.
export function dateInIsrael(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(
    new Date(iso)
  );
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The first Sunday strictly after the given date (the start of "next week").
export function nextSunday(isoDate: string): string {
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const daysUntil = (7 - weekday) % 7 || 7;
  return addDays(isoDate, daysUntil);
}

export function formatMoney(value: number | string): string {
  const n = Number(value);
  const sign = n < 0 ? "-" : "";
  return `${LRM}${sign}₪${Math.abs(n).toLocaleString("he-IL")}`;
}

export function formatSignedMoney(value: number): string {
  const sign = value < 0 ? "-" : "+";
  return `${LRM}${sign}₪${Math.abs(value).toLocaleString("he-IL")}`;
}

// 2026-10-02 -> 02.10
export function formatShortDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;
}

// 2026-10-02 -> 02.10.2026
export function formatFullDate(isoDate: string): string {
  return `${formatShortDate(isoDate)}.${isoDate.slice(0, 4)}`;
}

// 2026-10-02 -> שישי
export function hebrewDayName(isoDate: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    timeZone: "UTC",
  })
    .format(new Date(`${isoDate}T00:00:00Z`))
    .replace(/^יום\s+/, "");
}

// 2026-11-10 -> נובמבר 2026
export function formatMonthYear(isoDate: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

// 2026-10-02 -> יום שישי, 2 באוקטובר 2026
export function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

// "09:14" for today's timestamps, "01.10 09:14" otherwise.
export function formatUpdatedAt(iso: string, today: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const time = `${get("hour")}:${get("minute")}`;
  const date = `${get("day")}.${get("month")}`;
  const isToday = date === formatShortDate(today);
  return isToday ? time : `${date} ${time}`;
}
