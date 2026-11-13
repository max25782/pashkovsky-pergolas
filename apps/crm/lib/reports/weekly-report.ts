/**
 * Weekly owner report: which deals and money were planned for last week, what
 * happened, and what is expected next week. Pure: no React, no Supabase, no clock
 * (callers pass `now`), so every rule below is covered by tests.
 *
 * Rules (the system is the only source; the bank is never read):
 *  - Amount of a deal = deals.price: the client price after any discount.
 *  - A deal is "committed" when its column has a revenue role (signed ... completed);
 *    leads and offers still being discussed are not plans.
 *  - A deal's due date = deals.installation_date, the date the CRM already uses as the
 *    completion date. "Planned for last week" = committed deal dated last week;
 *    "closed" = the same deal in a column with the `completed` role. So closed is
 *    always a part of planned, and planned - closed is what slipped.
 *  - Money is tracked separately: planned payments (stage payments the firm entered per
 *    deal) due in the week versus deal_payments actually received in the week.
 *  - "Last week" = the 7 days before the send date, "next week" = the send date plus 6
 *    days, in the firm's time zone. For the default Sunday send that is Sunday-Saturday.
 */

import {
  REVENUE_ROLES,
  activeStages,
  resolverFor,
  stageLabel,
  type DealStageDef,
  type StageRoleResolver,
} from '@/lib/deals/stages'
import { rankDealsByNetProfit, type DealFinanceContext } from '@/lib/deals/deal-profit'
import { roundMoney } from '@/lib/finance/money'

export const DEFAULT_TIMEZONE = 'Asia/Jerusalem'

// --- Dates -----------------------------------------------------------------

/** YYYY-MM-DD */
export type DateKey = string

export interface ZonedMoment {
  dateKey: DateKey
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number
  hour: number
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function zonedMoment(date: Date, timeZone: string): ZonedMoment {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = WEEKDAY_INDEX[get('weekday')]
  if (weekday === undefined) throw new RangeError(`Cannot read weekday for time zone ${timeZone}`)
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    weekday,
    hour: Number(get('hour')),
  }
}

/** The local calendar date of an instant in the firm's time zone; null for an empty or invalid value. */
export function dateKeyInZone(value: string | null | undefined, timeZone: string): DateKey | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return zonedMoment(date, timeZone).dateKey
}

export function addDays(dateKey: DateKey, days: number): DateKey {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d + days))
  return date.toISOString().slice(0, 10)
}

export interface ReportPeriod {
  lastStart: DateKey
  lastEnd: DateKey
  nextStart: DateKey
  nextEnd: DateKey
}

export function reportPeriod(todayKey: DateKey): ReportPeriod {
  return {
    lastStart: addDays(todayKey, -7),
    lastEnd: addDays(todayKey, -1),
    nextStart: todayKey,
    nextEnd: addDays(todayKey, 6),
  }
}

/** The Sunday that starts the week of `todayKey`: the key that makes a week send at most once. */
export function weekAnchor(moment: ZonedMoment): DateKey {
  return addDays(moment.dateKey, -moment.weekday)
}

export interface ReportSchedule {
  enabled: boolean
  weekday: number
  hour: number
  timezone: string
}

/**
 * Due on the configured weekday from the configured hour on. "From the hour on" (not
 * "at the hour") lets a missed or delayed cron run still deliver the same day; the
 * log's unique key keeps that from sending twice.
 */
export function isReportDue(now: Date, schedule: ReportSchedule): boolean {
  if (!schedule.enabled) return false
  const moment = zonedMoment(now, schedule.timezone)
  return moment.weekday === schedule.weekday && moment.hour >= schedule.hour
}

// --- Input -----------------------------------------------------------------

export interface ReportDeal {
  id: string
  customer_name?: string | null
  stage?: string | null
  price?: number | string | null
  my_cost?: number | string | null
  installation_date?: string | null
}

export interface ReportPlannedPayment {
  deal_id: string
  amount: number | string
  due_date: string | null
}

export interface ReportReceivedPayment {
  deal_id: string
  amount: number | string
  paid_at: string
}

export interface WeeklyReportInput {
  now: Date
  timeZone: string
  deals: readonly ReportDeal[]
  plannedPayments: readonly ReportPlannedPayment[]
  receivedPayments: readonly ReportReceivedPayment[]
  stages: readonly DealStageDef[]
  roleOf?: StageRoleResolver
  finance: DealFinanceContext
  /** Report language, used for stage names. */
  locale: string
  /** Translates a stage key of the built-in aluminium set; see stageLabel. */
  defaultStageLabel?: (key: string) => string | undefined
}

// --- Output ----------------------------------------------------------------

export interface CountAmount {
  count: number
  amount: number
}

export interface StageLine extends CountAmount {
  key: string
  label: string
}

export interface TopProject {
  dealId: string
  name: string
  price: number
  netProfit: number
}

export interface WeeklyReport {
  period: ReportPeriod
  lastWeek: {
    plannedDeals: CountAmount
    closedDeals: CountAmount
    /** Planned and not closed (slipped). */
    openDeals: CountAmount
    plannedPayments: CountAmount
    receivedPayments: CountAmount
  }
  nextWeek: {
    deals: CountAmount
    plannedPayments: CountAmount
  }
  openByStage: StageLine[]
  topProject: TopProject | null
  noDueDate: {
    deals: CountAmount
    payments: CountAmount
  }
}

function amountOf(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function sum(items: readonly number[]): CountAmount {
  return { count: items.length, amount: roundMoney(items.reduce((a, b) => a + b, 0)) }
}

function inRange(key: DateKey | null, from: DateKey, to: DateKey): boolean {
  return key !== null && key >= from && key <= to
}

export function isEmptyReport(report: WeeklyReport): boolean {
  const counts = [
    report.lastWeek.plannedDeals.count,
    report.lastWeek.closedDeals.count,
    report.lastWeek.plannedPayments.count,
    report.lastWeek.receivedPayments.count,
    report.nextWeek.deals.count,
    report.nextWeek.plannedPayments.count,
    report.openByStage.length,
    report.noDueDate.deals.count,
    report.noDueDate.payments.count,
  ]
  return counts.every((c) => c === 0)
}

/** The report, or null when the system holds nothing to report: no e-mail is sent then. */
export function buildWeeklyReport(input: WeeklyReportInput): WeeklyReport | null {
  const { timeZone, stages } = input
  const roleOf = input.roleOf ?? resolverFor(stages)
  const period = reportPeriod(zonedMoment(input.now, timeZone).dateKey)

  const dealsById = new Map(input.deals.map((d) => [d.id, d]))
  const isCompleted = (d: ReportDeal) => roleOf(d.stage) === 'completed'
  const isCommitted = (d: ReportDeal) => {
    const role = roleOf(d.stage)
    return role !== null && REVENUE_ROLES.has(role)
  }
  const dueKey = (d: ReportDeal) => dateKeyInZone(d.installation_date, timeZone)

  const committed = input.deals.filter(isCommitted)
  const plannedLast = committed.filter((d) => inRange(dueKey(d), period.lastStart, period.lastEnd))
  const closedLast = plannedLast.filter(isCompleted)
  const slippedLast = plannedLast.filter((d) => !isCompleted(d))
  const nextDeals = committed.filter(
    (d) => !isCompleted(d) && inRange(dueKey(d), period.nextStart, period.nextEnd),
  )

  const priceSum = (deals: readonly ReportDeal[]) => sum(deals.map((d) => amountOf(d.price)))

  // Payments of deals that no longer exist or belong to another firm never reach here:
  // the loader selects by company_id. A payment of an unknown deal is still counted.
  const plannedPaymentsIn = (from: DateKey, to: DateKey) =>
    sum(
      input.plannedPayments
        .filter((p) => inRange(dateKeyInZone(p.due_date, timeZone), from, to))
        .map((p) => amountOf(p.amount)),
    )
  const receivedLast = sum(
    input.receivedPayments
      .filter((p) => inRange(dateKeyInZone(p.paid_at, timeZone), period.lastStart, period.lastEnd))
      .map((p) => amountOf(p.amount)),
  )

  // Open deals by the firm's own columns, in column order. Deals with no stage sit in the
  // first column, as on the board; a stage that is not one of the firm's columns is not guessed.
  const columns = activeStages(stages)
  const lines = new Map<string, number[]>()
  for (const column of columns) {
    if (column.role === 'completed') continue
    lines.set(column.key, [])
  }
  const firstOpenKey = columns.find((c) => c.role !== 'completed')?.key
  for (const deal of input.deals) {
    if (isCompleted(deal)) continue
    const key = deal.stage ? deal.stage : firstOpenKey
    const bucket = key ? lines.get(key) : undefined
    if (bucket) bucket.push(amountOf(deal.price))
  }
  const openByStage: StageLine[] = columns
    .filter((c) => c.role !== 'completed')
    .map((c) => {
      const totals = sum(lines.get(c.key) ?? [])
      return {
        key: c.key,
        label: stageLabel(c, input.locale, input.defaultStageLabel),
        ...totals,
      }
    })
    .filter((line) => line.count > 0)

  // The week's most profitable project: net profit (price and materials without VAT, minus
  // workers) among the deals closed last week.
  const top = rankDealsByNetProfit(closedLast, input.finance, 1)[0]
  const topProject: TopProject | null =
    top && top.finance.netProfit > 0
      ? {
          dealId: top.deal.id,
          name: top.deal.customer_name?.trim() || top.deal.id,
          price: top.finance.price,
          netProfit: top.finance.netProfit,
        }
      : null

  // Work that has no due date: committed open deals without one, and planned payments of
  // open deals without one.
  const undatedDeals = committed.filter((d) => !isCompleted(d) && dueKey(d) === null)
  const undatedPayments = sum(
    input.plannedPayments
      .filter((p) => dateKeyInZone(p.due_date, timeZone) === null)
      .filter((p) => {
        const deal = dealsById.get(p.deal_id)
        return deal !== undefined && !isCompleted(deal)
      })
      .map((p) => amountOf(p.amount)),
  )

  const report: WeeklyReport = {
    period,
    lastWeek: {
      plannedDeals: priceSum(plannedLast),
      closedDeals: priceSum(closedLast),
      openDeals: priceSum(slippedLast),
      plannedPayments: plannedPaymentsIn(period.lastStart, period.lastEnd),
      receivedPayments: receivedLast,
    },
    nextWeek: {
      deals: priceSum(nextDeals),
      plannedPayments: plannedPaymentsIn(period.nextStart, period.nextEnd),
    },
    openByStage,
    topProject,
    noDueDate: { deals: priceSum(undatedDeals), payments: undatedPayments },
  }
  return isEmptyReport(report) ? null : report
}
