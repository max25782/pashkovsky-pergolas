/**
 * Sends the weekly owner report to every firm that is due. Called hourly by the cron
 * route. Safe to call repeatedly: the unique (company, week) row in weekly_report_log is
 * claimed before anything is computed, so a week is sent at most once per firm.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { buildWeeklyReport, isReportDue, weekAnchor, zonedMoment } from '@/lib/reports/weekly-report'
import { renderWeeklyReportEmail } from '@/lib/reports/weekly-report-email'
import {
  loadFirmReportIdentity,
  loadOwnerAdminEmails,
  loadReportSettings,
  loadWeeklyReportInput,
  resolveReportLanguage,
} from '@/lib/reports/weekly-report-store'

export type ReportOutcome =
  | 'sent'
  | 'not_due'
  | 'disabled'
  | 'already_sent'
  | 'no_data'
  | 'no_recipients'
  | 'not_configured'
  | 'failed'

export interface ReportRunResult {
  companyId: string
  outcome: ReportOutcome
  recipients?: number
  error?: string
}

/** A claim that never finished (the process died) is taken over after this long. */
const STALE_CLAIM_MS = 60 * 60 * 1000

async function claimWeek(
  supabase: SupabaseClient,
  companyId: string,
  weekStart: string,
  now: Date,
): Promise<boolean> {
  const { error: staleError } = await supabase
    .from('weekly_report_log')
    .delete()
    .eq('company_id', companyId)
    .eq('week_start', weekStart)
    .eq('status', 'sending')
    .lt('created_at', new Date(now.getTime() - STALE_CLAIM_MS).toISOString())
  if (staleError) throw new Error(`Failed to clear stale report claim: ${staleError.message}`)

  const { error } = await supabase
    .from('weekly_report_log')
    .insert({ company_id: companyId, week_start: weekStart, status: 'sending' })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`Failed to claim report week: ${error.message}`)
}

async function releaseClaim(supabase: SupabaseClient, companyId: string, weekStart: string): Promise<void> {
  const { error } = await supabase
    .from('weekly_report_log')
    .delete()
    .eq('company_id', companyId)
    .eq('week_start', weekStart)
  if (error) console.error('[weekly-report] could not release claim', { companyId, weekStart, error })
}

async function finishClaim(
  supabase: SupabaseClient,
  companyId: string,
  weekStart: string,
  status: 'sent' | 'no_data' | 'no_recipients',
  recipients: string[],
): Promise<void> {
  const { error } = await supabase
    .from('weekly_report_log')
    .update({ status, recipients, sent_at: status === 'sent' ? new Date().toISOString() : null })
    .eq('company_id', companyId)
    .eq('week_start', weekStart)
  if (error) throw new Error(`Failed to update report log: ${error.message}`)
}

export async function runWeeklyReportForCompany(
  supabase: SupabaseClient,
  companyId: string,
  now: Date,
): Promise<ReportRunResult> {
  const settings = await loadReportSettings(supabase, companyId)
  if (!settings) return { companyId, outcome: 'not_configured' }
  if (!settings.enabled) return { companyId, outcome: 'disabled' }
  if (!isReportDue(now, settings)) return { companyId, outcome: 'not_due' }

  const weekStart = weekAnchor(zonedMoment(now, settings.timezone))
  if (!(await claimWeek(supabase, companyId, weekStart, now))) return { companyId, outcome: 'already_sent' }

  // Once any e-mail is out the claim must stay, or the next hourly run would send it again.
  const delivered: string[] = []
  try {
    const identity = await loadFirmReportIdentity(supabase, companyId)
    const language = resolveReportLanguage(settings, identity)
    const input = await loadWeeklyReportInput(supabase, companyId, now, settings.timezone, language)
    const report = buildWeeklyReport(input)
    if (!report) {
      await finishClaim(supabase, companyId, weekStart, 'no_data', [])
      return { companyId, outcome: 'no_data' }
    }

    const recipients = settings.recipientEmail
      ? [settings.recipientEmail]
      : await loadOwnerAdminEmails(supabase, companyId)
    if (recipients.length === 0) {
      await finishClaim(supabase, companyId, weekStart, 'no_recipients', [])
      return { companyId, outcome: 'no_recipients' }
    }

    const email = renderWeeklyReportEmail(report, {
      firmName: identity.name,
      language,
      currency: identity.currency,
    })
    const failures: string[] = []
    for (const to of recipients) {
      try {
        await sendEmail({ to, subject: email.subject, html: email.html, fromName: identity.name || undefined })
        delivered.push(to)
      } catch (error) {
        console.error('[weekly-report] send failed', { companyId, to, error })
        failures.push(error instanceof Error ? error.message : String(error))
      }
    }
    if (delivered.length === 0) {
      await releaseClaim(supabase, companyId, weekStart)
      return { companyId, outcome: 'failed', error: failures[0] ?? 'no recipient accepted the report' }
    }
    await finishClaim(supabase, companyId, weekStart, 'sent', delivered)
    return { companyId, outcome: 'sent', recipients: delivered.length }
  } catch (error) {
    if (delivered.length === 0) await releaseClaim(supabase, companyId, weekStart)
    throw error
  }
}

/** Every active or trial firm (or just `onlyCompanyId`), one after another. A failing firm never stops the rest. */
export async function runWeeklyReports(
  supabase: SupabaseClient,
  now: Date,
  onlyCompanyId?: string,
): Promise<ReportRunResult[]> {
  let query = supabase.from('companies').select('id').in('status', ['active', 'trial'])
  if (onlyCompanyId) query = query.eq('id', onlyCompanyId)
  const { data, error } = await query
  if (error) throw new Error(`Failed to list companies: ${error.message}`)

  const results: ReportRunResult[] = []
  for (const row of data ?? []) {
    const companyId = String((row as { id: string }).id)
    try {
      results.push(await runWeeklyReportForCompany(supabase, companyId, now))
    } catch (error) {
      console.error('[weekly-report] firm failed', { companyId, error })
      results.push({ companyId, outcome: 'failed', error: error instanceof Error ? error.message : String(error) })
    }
  }
  return results
}
