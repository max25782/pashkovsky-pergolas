/**
 * Per-firm settings of the weekly owner report. Pure: parsing and defaults only;
 * weekly-report-store.ts reads and writes them.
 */

import { DEFAULT_TIMEZONE } from '@/lib/reports/weekly-report'

export type ReportLanguage = 'he' | 'ru' | 'en' | 'sr'
export const REPORT_LANGUAGES: readonly ReportLanguage[] = ['he', 'ru', 'en', 'sr']

export interface WeeklyReportSettings {
  enabled: boolean
  /** null: owners and admins of the firm. */
  recipientEmail: string | null
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number
  hour: number
  timezone: string
  /** null: the firm's language. */
  language: ReportLanguage | null
}

/** A firm that never saved settings: off until an owner turns it on (Sunday 08:00 when enabled). */
export const DEFAULT_REPORT_SETTINGS: WeeklyReportSettings = {
  enabled: false,
  recipientEmail: null,
  weekday: 0,
  hour: 8,
  timezone: DEFAULT_TIMEZONE,
  language: null,
}

export type SettingsErrorCode =
  | 'enabled_invalid'
  | 'recipient_invalid'
  | 'weekday_invalid'
  | 'hour_invalid'
  | 'timezone_invalid'
  | 'language_invalid'

const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

export function isReportLanguage(value: unknown): value is ReportLanguage {
  return typeof value === 'string' && (REPORT_LANGUAGES as readonly string[]).includes(value)
}

export interface SettingsParseResult {
  settings: WeeklyReportSettings
  errors: SettingsErrorCode[]
}

/**
 * Applies a request body on top of the current settings. Only known fields count; an
 * invalid field is reported and keeps its current value, nothing is ever coerced
 * silently. An empty recipient / language means "back to the default".
 */
export function applySettingsUpdate(
  current: WeeklyReportSettings,
  body: Record<string, unknown>,
): SettingsParseResult {
  const next: WeeklyReportSettings = { ...current }
  const errors: SettingsErrorCode[] = []

  if ('enabled' in body) {
    if (typeof body.enabled === 'boolean') next.enabled = body.enabled
    else errors.push('enabled_invalid')
  }

  if ('recipient_email' in body) {
    const raw = body.recipient_email
    if (raw === null || (typeof raw === 'string' && raw.trim() === '')) next.recipientEmail = null
    else if (typeof raw === 'string' && raw.trim().length <= 254 && EMAIL_PATTERN.test(raw.trim()))
      next.recipientEmail = raw.trim().toLowerCase()
    else errors.push('recipient_invalid')
  }

  if ('weekday' in body) {
    const n = body.weekday
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6) next.weekday = n
    else errors.push('weekday_invalid')
  }

  if ('hour' in body) {
    const n = body.hour
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 23) next.hour = n
    else errors.push('hour_invalid')
  }

  if ('timezone' in body) {
    const tz = body.timezone
    if (typeof tz === 'string' && tz.trim() !== '' && isValidTimeZone(tz.trim())) next.timezone = tz.trim()
    else errors.push('timezone_invalid')
  }

  if ('language' in body) {
    const lang = body.language
    if (lang === null || lang === '') next.language = null
    else if (isReportLanguage(lang)) next.language = lang
    else errors.push('language_invalid')
  }

  return { settings: next, errors }
}
