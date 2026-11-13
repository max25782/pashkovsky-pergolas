const sendEmail = jest.fn()
jest.mock('@/lib/email', () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args) }))
jest.mock('@/lib/whatsapp-send', () => ({ sendWhatsAppTemplate: jest.fn() }))

const store = {
  loadReportSettings: jest.fn(),
  loadFirmReportIdentity: jest.fn(),
  loadWeeklyReportInput: jest.fn(),
  loadOwnerAdminEmails: jest.fn(),
}
jest.mock('@/lib/reports/weekly-report-store', () => ({
  loadReportSettings: (...a: unknown[]) => store.loadReportSettings(...a),
  loadFirmReportIdentity: (...a: unknown[]) => store.loadFirmReportIdentity(...a),
  loadWeeklyReportInput: (...a: unknown[]) => store.loadWeeklyReportInput(...a),
  loadOwnerAdminEmails: (...a: unknown[]) => store.loadOwnerAdminEmails(...a),
  resolveReportLanguage: (s: { language: string | null }, i: { firmLanguage: string | null }) =>
    s.language ?? i.firmLanguage ?? 'he',
}))

import { stagesForNewFirm } from '@/lib/deals/stages'
import { runWeeklyReports } from '../weekly-report-runner'
import { DEFAULT_REPORT_SETTINGS } from '../weekly-report-settings'
import type { WeeklyReportInput } from '../weekly-report'

const SUNDAY_MORNING = new Date('2026-11-15T06:30:00Z') // 08:30 Jerusalem
const NEXT_SUNDAY = new Date('2026-11-22T06:30:00Z')

type Row = Record<string, unknown>

/** Just enough of the query builder for the companies list and the send log (with its unique key). */
function fakeSupabase(companyIds: string[], logRows: Row[]) {
  function logQuery() {
    let op: 'insert' | 'update' | 'delete' = 'update'
    let payload: Row = {}
    const eq: Array<[string, unknown]> = []
    let before: string | null = null
    const hit = () =>
      logRows.filter(
        (r) =>
          eq.every(([k, v]) => r[k] === v) && (before === null || String(r.created_at) < before),
      )
    const api = {
      insert(row: Row) {
        op = 'insert'
        payload = row
        return api
      },
      update(patch: Row) {
        op = 'update'
        payload = patch
        return api
      },
      delete() {
        op = 'delete'
        return api
      },
      eq(k: string, v: unknown) {
        eq.push([k, v])
        return api
      },
      lt(_k: string, v: string) {
        before = v
        return api
      },
      then(resolve: (v: { error: { code?: string; message: string } | null }) => unknown) {
        if (op === 'insert') {
          const dup = logRows.some(
            (r) => r.company_id === payload.company_id && r.week_start === payload.week_start,
          )
          if (dup) return Promise.resolve(resolve({ error: { code: '23505', message: 'duplicate key' } }))
          logRows.push({ ...payload, created_at: new Date().toISOString() })
        } else if (op === 'update') hit().forEach((r) => Object.assign(r, payload))
        else {
          const gone = new Set(hit())
          for (let i = logRows.length - 1; i >= 0; i--) if (gone.has(logRows[i])) logRows.splice(i, 1)
        }
        return Promise.resolve(resolve({ error: null }))
      },
    }
    return api
  }

  return {
    from(table: string) {
      if (table === 'companies') {
        const api = {
          select: () => api,
          in: () => api,
          eq: (_k: string, v: string) => {
            companyIds = companyIds.filter((id) => id === v)
            return api
          },
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolve({ data: companyIds.map((id) => ({ id })), error: null })),
        }
        return api
      }
      if (table === 'weekly_report_log') return logQuery()
      throw new Error(`unexpected table ${table}`)
    },
  }
}

function reportInput(withDeals: boolean): WeeklyReportInput {
  const stages = stagesForNewFirm('repair')
  const completed = stages.find((s) => s.role === 'completed')!.key
  const working = stages.find((s) => s.role === 'in_production')!.key
  const deals = withDeals
    ? [
        { id: 'a', customer_name: 'A', stage: completed, price: 1000, installation_date: '2026-11-09T09:00:00Z' },
        { id: 'b', customer_name: 'B', stage: working, price: 2000, installation_date: '2026-11-10T09:00:00Z' },
      ]
    : []
  return {
    now: SUNDAY_MORNING,
    timeZone: 'Asia/Jerusalem',
    deals,
    plannedPayments: [],
    receivedPayments: [],
    stages,
    finance: { vatPercent: 18, laborByDeal: {} },
    locale: 'en',
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  store.loadReportSettings.mockResolvedValue({ ...DEFAULT_REPORT_SETTINGS, enabled: true })
  store.loadFirmReportIdentity.mockResolvedValue({ name: 'Test Firm', currency: 'ILS', firmLanguage: 'en' })
  store.loadOwnerAdminEmails.mockResolvedValue(['owner@test.com', 'admin@test.com'])
  store.loadWeeklyReportInput.mockResolvedValue(reportInput(true))
  sendEmail.mockResolvedValue({ success: true })
})

describe('runWeeklyReports', () => {
  it('sends to owners and admins on the due day, once', async () => {
    const log: Row[] = []
    const db = fakeSupabase(['c1'], log) as never

    const first = await runWeeklyReports(db, SUNDAY_MORNING)
    expect(first).toEqual([{ companyId: 'c1', outcome: 'sent', recipients: 2 }])
    expect(sendEmail).toHaveBeenCalledTimes(2)
    expect(sendEmail.mock.calls.map((c) => c[0].to)).toEqual(['owner@test.com', 'admin@test.com'])
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ fromName: 'Test Firm' })
    expect(sendEmail.mock.calls[0][0].subject).toContain('Weekly report')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ company_id: 'c1', week_start: '2026-11-15', status: 'sent' })

    // The cron runs again an hour later, and again the same evening: nothing more goes out.
    const again = await runWeeklyReports(db, new Date('2026-11-15T07:30:00Z'))
    expect(again[0].outcome).toBe('already_sent')
    const evening = await runWeeklyReports(db, new Date('2026-11-15T17:00:00Z'))
    expect(evening[0].outcome).toBe('already_sent')
    expect(sendEmail).toHaveBeenCalledTimes(2)

    // Next Sunday is a new week.
    store.loadWeeklyReportInput.mockResolvedValue({ ...reportInput(true), now: NEXT_SUNDAY })
    const next = await runWeeklyReports(db, NEXT_SUNDAY)
    expect(next[0].outcome).toBe('sent')
    expect(log.map((r) => r.week_start)).toEqual(['2026-11-15', '2026-11-22'])
  })

  it('a single recipient address replaces the owners and admins', async () => {
    store.loadReportSettings.mockResolvedValue({ ...DEFAULT_REPORT_SETTINGS, enabled: true, recipientEmail: 'boss@test.com' })
    const results = await runWeeklyReports(fakeSupabase(['c1'], []) as never, SUNDAY_MORNING)
    expect(results[0]).toMatchObject({ outcome: 'sent', recipients: 1 })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0].to).toBe('boss@test.com')
    expect(store.loadOwnerAdminEmails).not.toHaveBeenCalled()
  })

  it('sends no e-mail when there is no data, and does not look again that week', async () => {
    store.loadWeeklyReportInput.mockResolvedValue(reportInput(false))
    const log: Row[] = []
    const db = fakeSupabase(['c1'], log) as never
    expect((await runWeeklyReports(db, SUNDAY_MORNING))[0].outcome).toBe('no_data')
    expect(sendEmail).not.toHaveBeenCalled()
    expect(log[0]).toMatchObject({ status: 'no_data' })
    expect((await runWeeklyReports(db, new Date('2026-11-15T09:00:00Z')))[0].outcome).toBe('already_sent')
    expect(store.loadWeeklyReportInput).toHaveBeenCalledTimes(1)
  })

  it('does nothing before the hour, on another day, when switched off, or before migration 065', async () => {
    const db = fakeSupabase(['c1'], []) as never
    expect((await runWeeklyReports(db, new Date('2026-11-15T05:00:00Z')))[0].outcome).toBe('not_due')
    expect((await runWeeklyReports(db, new Date('2026-11-17T06:30:00Z')))[0].outcome).toBe('not_due')
    store.loadReportSettings.mockResolvedValue({ ...DEFAULT_REPORT_SETTINGS, enabled: false })
    expect((await runWeeklyReports(db, SUNDAY_MORNING))[0].outcome).toBe('disabled')
    store.loadReportSettings.mockResolvedValue(null)
    expect((await runWeeklyReports(db, SUNDAY_MORNING))[0].outcome).toBe('not_configured')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('a firm with nobody to send to is logged and skipped', async () => {
    store.loadOwnerAdminEmails.mockResolvedValue([])
    const log: Row[] = []
    const results = await runWeeklyReports(fakeSupabase(['c1'], log) as never, SUNDAY_MORNING)
    expect(results[0].outcome).toBe('no_recipients')
    expect(log[0]).toMatchObject({ status: 'no_recipients' })
  })

  it('when no address accepts the mail the claim is released, so the next run retries', async () => {
    sendEmail.mockRejectedValue(new Error('smtp down'))
    const log: Row[] = []
    const db = fakeSupabase(['c1'], log) as never
    const failed = await runWeeklyReports(db, SUNDAY_MORNING)
    expect(failed[0]).toMatchObject({ outcome: 'failed', error: 'smtp down' })
    expect(log).toHaveLength(0)

    sendEmail.mockResolvedValue({ success: true })
    const retry = await runWeeklyReports(db, new Date('2026-11-15T07:30:00Z'))
    expect(retry[0].outcome).toBe('sent')
  })

  it('one rejected address does not stop the others, and the week counts as sent', async () => {
    sendEmail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === 'owner@test.com') throw new Error('mailbox full')
      return { success: true }
    })
    const log: Row[] = []
    const results = await runWeeklyReports(fakeSupabase(['c1'], log) as never, SUNDAY_MORNING)
    expect(results[0]).toMatchObject({ outcome: 'sent', recipients: 1 })
    expect(log[0]).toMatchObject({ status: 'sent', recipients: ['admin@test.com'] })
  })

  it('an error while building the report releases the claim and never stops other firms', async () => {
    store.loadWeeklyReportInput.mockRejectedValueOnce(new Error('db down'))
    const log: Row[] = []
    const results = await runWeeklyReports(fakeSupabase(['c1', 'c2'], log) as never, SUNDAY_MORNING)
    expect(results[0]).toMatchObject({ companyId: 'c1', outcome: 'failed', error: 'db down' })
    expect(results[1]).toMatchObject({ companyId: 'c2', outcome: 'sent' })
    expect(log.map((r) => r.company_id)).toEqual(['c2'])
  })

  it('uses each firm own language: the setting wins over the firm language', async () => {
    store.loadReportSettings.mockResolvedValue({ ...DEFAULT_REPORT_SETTINGS, enabled: true, language: 'ru' })
    await runWeeklyReports(fakeSupabase(['c1'], []) as never, SUNDAY_MORNING)
    expect(sendEmail.mock.calls[0][0].subject).toContain('Недельный отчёт')
  })
})
