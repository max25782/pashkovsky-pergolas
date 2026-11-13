/**
 * Database access of the weekly owner report. Everything is read per firm
 * (company_id); the bank is never touched. The pure rules live in weekly-report.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import enMessages from '@/messages/en.json'
import heMessages from '@/messages/he.json'
import ruMessages from '@/messages/ru.json'
import srMessages from '@/messages/sr.json'
import { isMissingReportTable } from '@/lib/reports/missing-table'
import { loadCompanyVatPercent } from '@/lib/deals/company-vat'
import { loadCompanyStages } from '@/lib/deals/stage-store'
import { resolverFor } from '@/lib/deals/stages'
import { laborByDeal, loadCompanyShifts, loadWorkerCostBook } from '@/lib/workers/load-cost-book'
import {
  addDays,
  reportPeriod,
  zonedMoment,
  type ReportDeal,
  type ReportPlannedPayment,
  type ReportReceivedPayment,
  type WeeklyReportInput,
} from '@/lib/reports/weekly-report'
import {
  DEFAULT_REPORT_SETTINGS,
  isReportLanguage,
  type ReportLanguage,
  type WeeklyReportSettings,
} from '@/lib/reports/weekly-report-settings'

const PAGE_SIZE = 1000

interface SettingsRow {
  enabled: boolean
  recipient_email: string | null
  weekday: number
  hour: number
  timezone: string
  language: string | null
}

const SETTINGS_COLUMNS = 'enabled, recipient_email, weekday, hour, timezone, language'

function settingsFromRow(row: SettingsRow): WeeklyReportSettings {
  return {
    enabled: row.enabled,
    recipientEmail: row.recipient_email,
    weekday: row.weekday,
    hour: row.hour,
    timezone: row.timezone,
    language: isReportLanguage(row.language) ? row.language : null,
  }
}

/**
 * The firm's settings, or the defaults when it never saved any. Null when the table does
 * not exist yet (migration 065 not applied): nothing is sent then.
 */
export async function loadReportSettings(
  supabase: SupabaseClient,
  companyId: string,
): Promise<WeeklyReportSettings | null> {
  const { data, error } = await supabase
    .from('weekly_report_settings')
    .select(SETTINGS_COLUMNS)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) {
    if (isMissingReportTable(error)) return null
    throw new Error(`Failed to load weekly report settings: ${error.message}`)
  }
  return data ? settingsFromRow(data as SettingsRow) : { ...DEFAULT_REPORT_SETTINGS }
}

export async function saveReportSettings(
  supabase: SupabaseClient,
  companyId: string,
  settings: WeeklyReportSettings,
): Promise<void> {
  const { error } = await supabase.from('weekly_report_settings').upsert(
    {
      company_id: companyId,
      enabled: settings.enabled,
      recipient_email: settings.recipientEmail,
      weekday: settings.weekday,
      hour: settings.hour,
      timezone: settings.timezone,
      language: settings.language,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  )
  if (error) throw new Error(`Failed to save weekly report settings: ${error.message}`)
}

export interface FirmReportIdentity {
  name: string
  currency: string
  /** companies.settings.language, when it is one the report speaks. */
  firmLanguage: ReportLanguage | null
}

export async function loadFirmReportIdentity(
  supabase: SupabaseClient,
  companyId: string,
): Promise<FirmReportIdentity> {
  const [company, settings] = await Promise.all([
    supabase.from('companies').select('name, settings').eq('id', companyId).maybeSingle(),
    supabase
      .from('company_settings')
      .select('currency')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (company.error) throw new Error(`Failed to load company: ${company.error.message}`)
  if (settings.error) console.error('[weekly-report] company_settings lookup failed:', settings.error)
  const row = company.data as { name?: string | null; settings?: { language?: unknown } | null } | null
  const language = row?.settings?.language
  const currency = (settings.data as { currency?: string | null } | null)?.currency?.trim()
  return {
    name: row?.name?.trim() ?? '',
    currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : 'ILS',
    firmLanguage: isReportLanguage(language) ? language : null,
  }
}

/** Language of the report: the firm's choice, else the firm's language, else Hebrew. */
export function resolveReportLanguage(
  settings: WeeklyReportSettings,
  identity: FirmReportIdentity,
): ReportLanguage {
  return settings.language ?? identity.firmLanguage ?? 'he'
}

/** Owners and admins of the firm and nobody else. */
export async function loadOwnerAdminEmails(supabase: SupabaseClient, companyId: string): Promise<string[]> {
  const { data: members, error } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
    .in('role', ['owner', 'admin'])
  if (error) throw new Error(`Failed to load company members: ${error.message}`)
  const userIds = [...new Set((members ?? []).map((m) => String((m as { user_id: string }).user_id)))]
  if (userIds.length === 0) return []
  const { data: users, error: usersError } = await supabase.from('users').select('email').in('id', userIds)
  if (usersError) throw new Error(`Failed to load users: ${usersError.message}`)
  const emails = new Set<string>()
  for (const u of users ?? []) {
    const email = (u as { email: string | null }).email?.trim().toLowerCase()
    if (email) emails.add(email)
  }
  return [...emails]
}

const STAGE_MESSAGES: Record<ReportLanguage, Record<string, string>> = {
  en: enMessages.deals.stages,
  he: heMessages.deals.stages,
  ru: ruMessages.deals.stages,
  sr: srMessages.deals.stages,
}

export function defaultStageLabelFor(language: ReportLanguage): (key: string) => string | undefined {
  return (key) => STAGE_MESSAGES[language][key]
}

async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string; code?: string } | null }>,
  what: string,
  tolerateMissing = false,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) {
      if (tolerateMissing && isMissingReportTable(error)) return []
      throw new Error(`Failed to load ${what}: ${error.message}`)
    }
    const chunk = (data ?? []) as T[]
    rows.push(...chunk)
    if (chunk.length < PAGE_SIZE) break
  }
  return rows
}

/** Everything the report builder needs for one firm. */
export async function loadWeeklyReportInput(
  supabase: SupabaseClient,
  companyId: string,
  now: Date,
  timeZone: string,
  language: ReportLanguage,
): Promise<WeeklyReportInput> {
  const period = reportPeriod(zonedMoment(now, timeZone).dateKey)
  // One day of margin each side: payments are timestamps, the builder cuts at the firm's local days.
  const receivedFrom = `${addDays(period.lastStart, -1)}T00:00:00Z`
  const receivedTo = `${addDays(period.lastEnd, 2)}T00:00:00Z`

  const [stagesLoaded, deals, plannedPayments, receivedPayments, vatPercent, shifts, book] = await Promise.all([
    loadCompanyStages(supabase, companyId),
    fetchAll<ReportDeal>(
      (from, to) =>
        supabase
          .from('deals')
          .select('id, customer_name, stage, price, my_cost, installation_date')
          .eq('company_id', companyId)
          .order('id', { ascending: true })
          .range(from, to),
      'deals',
    ),
    fetchAll<ReportPlannedPayment>(
      (from, to) =>
        supabase
          .from('planned_payments')
          .select('deal_id, amount, due_date')
          .eq('company_id', companyId)
          .order('id', { ascending: true })
          .range(from, to),
      'planned_payments',
      true,
    ),
    fetchAll<ReportReceivedPayment>(
      (from, to) =>
        supabase
          .from('deal_payments')
          .select('deal_id, amount, paid_at')
          .eq('company_id', companyId)
          .gte('paid_at', receivedFrom)
          .lt('paid_at', receivedTo)
          .order('id', { ascending: true })
          .range(from, to),
      'deal_payments',
    ),
    loadCompanyVatPercent(supabase, companyId),
    loadCompanyShifts(supabase, companyId, { dealLinkedOnly: true }),
    loadWorkerCostBook(supabase, companyId),
  ])

  return {
    now,
    timeZone,
    deals,
    plannedPayments,
    receivedPayments,
    stages: stagesLoaded.stages,
    roleOf: resolverFor(stagesLoaded.stages),
    finance: { vatPercent, laborByDeal: laborByDeal(shifts, book) },
    locale: language,
    defaultStageLabel: defaultStageLabelFor(language),
  }
}
