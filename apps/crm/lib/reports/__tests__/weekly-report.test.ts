jest.mock('@/lib/email', () => ({ sendEmail: jest.fn() }))
jest.mock('@/lib/whatsapp-send', () => ({ sendWhatsAppTemplate: jest.fn() }))

import { stagesForNewFirm, type DealStageDef } from '@/lib/deals/stages'
import {
  addDays,
  buildWeeklyReport,
  dateKeyInZone,
  isReportDue,
  reportPeriod,
  weekAnchor,
  zonedMoment,
  type ReportDeal,
  type WeeklyReportInput,
} from '../weekly-report'
import { renderWeeklyReportEmail } from '../weekly-report-email'
import { applySettingsUpdate, DEFAULT_REPORT_SETTINGS } from '../weekly-report-settings'
import { parsePlannedPayment } from '../planned-payment-input'

const TZ = 'Asia/Jerusalem'
/** Sunday 15 November 2026, 08:30 in Jerusalem (UTC+2): the report goes out now. */
const SUNDAY_MORNING = new Date('2026-11-15T06:30:00Z')

// A repair firm's own columns, not the aluminium set.
const STAGES: DealStageDef[] = stagesForNewFirm('repair')
const key = (role: string) => STAGES.find((s) => s.role === role)!.key
const SIGNED = key('signed')
const IN_PROGRESS = key('in_production')
const COMPLETED = key('completed')
const FIRST_COLUMN = STAGES[0].key // no role: a request, not yet a plan

function deal(id: string, stage: string | null, price: number, installation: string | null, name = id): ReportDeal {
  return { id, customer_name: name, stage, price, my_cost: 0, installation_date: installation }
}

function input(overrides: Partial<WeeklyReportInput>): WeeklyReportInput {
  return {
    now: SUNDAY_MORNING,
    timeZone: TZ,
    deals: [],
    plannedPayments: [],
    receivedPayments: [],
    stages: STAGES,
    finance: { vatPercent: 18, laborByDeal: {} },
    locale: 'en',
    ...overrides,
  }
}

describe('dates', () => {
  it('reads weekday, hour and date in the firm time zone, not UTC', () => {
    // 22:30 UTC on Saturday is already 00:30 on Sunday in Jerusalem.
    const moment = zonedMoment(new Date('2026-11-14T22:30:00Z'), TZ)
    expect(moment).toEqual({ dateKey: '2026-11-15', weekday: 0, hour: 0 })
  })

  it('last week is the 7 days before the send date, next week starts on it', () => {
    expect(reportPeriod('2026-11-15')).toEqual({
      lastStart: '2026-11-08',
      lastEnd: '2026-11-14',
      nextStart: '2026-11-15',
      nextEnd: '2026-11-21',
    })
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('a timestamp belongs to its local day', () => {
    expect(dateKeyInZone('2026-11-14T22:30:00Z', TZ)).toBe('2026-11-15')
    expect(dateKeyInZone('2026-11-14', TZ)).toBe('2026-11-14')
    expect(dateKeyInZone(null, TZ)).toBeNull()
    expect(dateKeyInZone('not a date', TZ)).toBeNull()
  })

  it('is due on the weekday from the hour on, never before and never on another day', () => {
    const schedule = { ...DEFAULT_REPORT_SETTINGS }
    expect(isReportDue(new Date('2026-11-15T05:59:00Z'), schedule)).toBe(false) // 07:59
    expect(isReportDue(new Date('2026-11-15T06:00:00Z'), schedule)).toBe(true) // 08:00
    expect(isReportDue(new Date('2026-11-15T15:00:00Z'), schedule)).toBe(true) // catch-up, same day
    expect(isReportDue(new Date('2026-11-16T06:30:00Z'), schedule)).toBe(false) // Monday
    expect(isReportDue(SUNDAY_MORNING, { ...schedule, enabled: false })).toBe(false)
  })

  it('every day of one week shares one log key, so changing the weekday cannot double-send', () => {
    const sunday = weekAnchor(zonedMoment(new Date('2026-11-15T06:30:00Z'), TZ))
    const wednesday = weekAnchor(zonedMoment(new Date('2026-11-18T06:30:00Z'), TZ))
    const nextSunday = weekAnchor(zonedMoment(new Date('2026-11-22T06:30:00Z'), TZ))
    expect(sunday).toBe('2026-11-15')
    expect(wednesday).toBe(sunday)
    expect(nextSunday).toBe('2026-11-22')
  })
})

describe('buildWeeklyReport: the acceptance scenario', () => {
  // A test firm: 5 deals planned for last week (Sun 8 - Sat 14 Nov), 2 of them closed.
  const deals: ReportDeal[] = [
    deal('c1', COMPLETED, 10_000, '2026-11-09T09:00:00Z', 'Closed one'),
    deal('c2', COMPLETED, 20_000, '2026-11-12T09:00:00Z', 'Closed two'),
    deal('p1', IN_PROGRESS, 5_000, '2026-11-10T09:00:00Z'),
    deal('p2', SIGNED, 6_000, '2026-11-11T09:00:00Z'),
    deal('p3', IN_PROGRESS, 7_000, '2026-11-14T09:00:00Z'),
    // not part of last week:
    deal('earlier', COMPLETED, 99_000, '2026-11-07T09:00:00Z'), // a day before the week
    deal('lead', FIRST_COLUMN, 3_000, '2026-11-10T09:00:00Z'), // a request is not a plan
    // next week:
    deal('n1', IN_PROGRESS, 8_000, '2026-11-17T09:00:00Z'),
    deal('n2', SIGNED, 4_000, '2026-11-21T09:00:00Z'),
    deal('later', SIGNED, 50_000, '2026-11-22T09:00:00Z'), // one day after next week
    // no due date:
    deal('open-no-date', SIGNED, 9_000, null),
  ]

  const report = buildWeeklyReport(
    input({
      deals,
      finance: { vatPercent: 18, laborByDeal: { c1: 1_000, c2: 2_000 } },
      plannedPayments: [
        { deal_id: 'p1', amount: 2_500, due_date: '2026-11-12' },
        { deal_id: 'n1', amount: 4_000, due_date: '2026-11-18' },
        { deal_id: 'open-no-date', amount: 3_000, due_date: null },
        { deal_id: 'c1', amount: 1_000, due_date: null }, // belongs to a finished deal: not an open question
      ],
      receivedPayments: [
        { deal_id: 'c1', amount: 10_000, paid_at: '2026-11-09T10:00:00Z' },
        { deal_id: 'p1', amount: 1_500, paid_at: '2026-11-12T10:00:00Z' },
        { deal_id: 'c2', amount: 777, paid_at: '2026-11-07T10:00:00Z' }, // before the week
      ],
    }),
  )

  it('reports 5 planned and 2 closed with their sums, and what slipped', () => {
    expect(report).not.toBeNull()
    expect(report!.lastWeek.plannedDeals).toEqual({ count: 5, amount: 48_000 })
    expect(report!.lastWeek.closedDeals).toEqual({ count: 2, amount: 30_000 })
    expect(report!.lastWeek.openDeals).toEqual({ count: 3, amount: 18_000 })
  })

  it('compares planned payments with the money that arrived', () => {
    expect(report!.lastWeek.plannedPayments).toEqual({ count: 1, amount: 2_500 })
    expect(report!.lastWeek.receivedPayments).toEqual({ count: 2, amount: 11_500 })
  })

  it('forecasts next week from deals and planned payments, open deals only', () => {
    expect(report!.nextWeek.deals).toEqual({ count: 2, amount: 12_000 })
    expect(report!.nextWeek.plannedPayments).toEqual({ count: 1, amount: 4_000 })
  })

  it('counts open deals under the firm own columns, in column order, finished ones left out', () => {
    expect(report!.openByStage.map((l) => l.key)).toEqual(
      STAGES.filter((s) => ['signed', 'in_production'].includes(s.role ?? '') || s.key === FIRST_COLUMN).map((s) => s.key),
    )
    const byKey = Object.fromEntries(report!.openByStage.map((l) => [l.key, l]))
    expect(byKey[FIRST_COLUMN]).toMatchObject({ count: 1, amount: 3_000 })
    expect(byKey[SIGNED]).toMatchObject({ count: 4, amount: 6_000 + 4_000 + 50_000 + 9_000 })
    expect(byKey[IN_PROGRESS]).toMatchObject({ count: 3, amount: 5_000 + 7_000 + 8_000 })
    expect(report!.openByStage.every((l) => l.label !== l.key)).toBe(true) // firm names, not keys
  })

  it('names the most profitable project of the week among the closed ones', () => {
    // net profit = price without VAT - labor: c2 = 20000/1.18 - 2000, c1 = 10000/1.18 - 1000
    expect(report!.topProject).toMatchObject({ dealId: 'c2', name: 'Closed two', price: 20_000 })
    expect(report!.topProject!.netProfit).toBeCloseTo(20_000 / 1.18 - 2_000, 1)
  })

  it('lists work without a due date: open committed deals and planned payments of open deals', () => {
    expect(report!.noDueDate.deals).toEqual({ count: 1, amount: 9_000 })
    expect(report!.noDueDate.payments).toEqual({ count: 1, amount: 3_000 })
  })
})

describe('buildWeeklyReport: edge cases', () => {
  it('returns null when the system holds nothing to report: no e-mail is sent', () => {
    expect(buildWeeklyReport(input({}))).toBeNull()
    // Only finished deals from long ago and nothing else.
    expect(buildWeeklyReport(input({ deals: [deal('old', COMPLETED, 5_000, '2026-01-10T09:00:00Z')] }))).toBeNull()
  })

  it('works for the default aluminium columns when the firm has none of its own', () => {
    const report = buildWeeklyReport(
      input({
        stages: [],
        deals: [deal('a', 'done', 1_000, '2026-11-10T09:00:00Z'), deal('b', 'production', 2_000, '2026-11-11T09:00:00Z')],
      }),
    )
    expect(report!.lastWeek.plannedDeals.count).toBe(2)
    expect(report!.lastWeek.closedDeals.count).toBe(1)
  })

  it('does not guess a column for a stage that is not one of the firm columns', () => {
    const report = buildWeeklyReport(input({ deals: [deal('x', 'lost', 5_000, null)] }))
    expect(report).toBeNull()
  })

  it('amounts of deals without a price count as zero, never NaN', () => {
    const report = buildWeeklyReport(
      input({ deals: [{ id: 'z', stage: SIGNED, price: null, installation_date: '2026-11-10T09:00:00Z' }] }),
    )
    expect(report!.lastWeek.plannedDeals).toEqual({ count: 1, amount: 0 })
  })
})

describe('renderWeeklyReportEmail', () => {
  const report = buildWeeklyReport(
    input({
      deals: [
        deal('c1', COMPLETED, 10_000, '2026-11-09T09:00:00Z', 'Closed <one>'),
        deal('p1', IN_PROGRESS, 5_000, '2026-11-10T09:00:00Z'),
      ],
    }),
  )!

  it('shows planned and closed counts with sums, escaped, left to right in English', () => {
    const email = renderWeeklyReportEmail(report, { firmName: 'Roof <b>Co</b>', language: 'en', currency: 'ILS' })
    expect(email.subject).toContain('Roof <b>Co</b>')
    expect(email.html).toContain('Roof &lt;b&gt;Co&lt;/b&gt;')
    expect(email.html).not.toContain('<b>Co</b>')
    expect(email.html).toContain('Planned')
    expect(email.html).toContain('Closed')
    expect(email.html).toMatch(/15,000/)
    expect(email.html).toContain('dir="ltr"')
    expect(email.html).toContain('Closed &lt;one&gt;')
  })

  it('is right to left in Hebrew and uses the firm language for the labels', () => {
    const he = renderWeeklyReportEmail(report, { firmName: 'חברה', language: 'he', currency: 'ILS' })
    expect(he.html).toContain('dir="rtl"')
    expect(he.html).toContain('תוכננו')
    const ru = renderWeeklyReportEmail(report, { firmName: 'Фирма', language: 'ru', currency: 'ILS' })
    expect(ru.html).toContain('Запланировано')
    expect(ru.subject).toContain('Недельный отчёт')
  })

  it('leaves out sections that are empty instead of printing zeros', () => {
    const email = renderWeeklyReportEmail(report, { firmName: 'F', language: 'en', currency: 'ILS' })
    expect(email.html).not.toContain('Planned payments with no date')
    expect(email.html).not.toContain('Next week forecast') // nothing is due next week
    expect(email.html).not.toContain('No due date') // every open deal here has a date
    expect(email.html).not.toContain('Last week: Payments') // no payment was planned or received
    expect(email.html).toContain('Most profitable project') // there is a closed deal with a profit
  })
})

describe('applySettingsUpdate', () => {
  it('applies valid fields and keeps the rest', () => {
    const { settings, errors } = applySettingsUpdate(DEFAULT_REPORT_SETTINGS, {
      enabled: false,
      recipient_email: ' Owner@Example.com ',
      weekday: 1,
      hour: 7,
      language: 'ru',
    })
    expect(errors).toEqual([])
    expect(settings).toMatchObject({
      enabled: false,
      recipientEmail: 'owner@example.com',
      weekday: 1,
      hour: 7,
      language: 'ru',
      timezone: 'Asia/Jerusalem',
    })
  })

  it('rejects bad values and reports every one, changing none of them', () => {
    const { settings, errors } = applySettingsUpdate(DEFAULT_REPORT_SETTINGS, {
      enabled: 'yes',
      recipient_email: 'a@b',
      weekday: 7,
      hour: 24,
      timezone: 'Mars/Base',
      language: 'fr',
    })
    expect(errors.sort()).toEqual(
      ['enabled_invalid', 'hour_invalid', 'language_invalid', 'recipient_invalid', 'timezone_invalid', 'weekday_invalid'].sort(),
    )
    expect(settings).toEqual(DEFAULT_REPORT_SETTINGS)
  })

  it('an empty recipient or language returns to the default; unknown fields are ignored', () => {
    const start = { ...DEFAULT_REPORT_SETTINGS, recipientEmail: 'x@y.com', language: 'en' as const }
    const { settings, errors } = applySettingsUpdate(start, { recipient_email: '', language: '', company_id: 'other' })
    expect(errors).toEqual([])
    expect(settings.recipientEmail).toBeNull()
    expect(settings.language).toBeNull()
  })
})

describe('parsePlannedPayment', () => {
  it('creates with amount only: no date and no label', () => {
    expect(parsePlannedPayment({ amount: '1500.456' }, 'create')).toEqual({
      fields: { amount: 1500.46, due_date: null, label: null },
      errors: [],
    })
  })

  it('rejects zero, negative, huge, non-numeric amounts and impossible dates', () => {
    for (const amount of [0, -5, 1e12, 'abc', null, undefined]) {
      expect(parsePlannedPayment({ amount }, 'create').errors).toContain('amount_invalid')
    }
    expect(parsePlannedPayment({ amount: 10, due_date: '2026-02-30' }, 'create').errors).toEqual(['due_date_invalid'])
    expect(parsePlannedPayment({ amount: 10, due_date: '15/11/2026' }, 'create').errors).toEqual(['due_date_invalid'])
  })

  it('an update touches only the fields it sends, and an empty date clears it', () => {
    expect(parsePlannedPayment({ due_date: '' }, 'update')).toEqual({ fields: { due_date: null }, errors: [] })
    expect(parsePlannedPayment({ company_id: 'x', deal_id: 'y' }, 'update').fields).toEqual({})
  })
})
