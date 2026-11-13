'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mail } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'
import type { WeeklyReportSettingsResponse } from '@/app/admin-api/weekly-report/settings/route'
import { REPORT_LANGUAGES } from '@/lib/reports/weekly-report-settings'

const LANGUAGE_NAMES: Record<string, string> = { he: 'עברית', ru: 'Русский', en: 'English', sr: 'Srpski' }
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const fieldClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent'

/** Owner and admin only: the API answers 403 to everyone else and the card then renders nothing. */
export function WeeklyReportSettingsCard() {
  const t = useTranslations('weeklyReport')
  const [data, setData] = useState<WeeklyReportSettingsResponse | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const [enabled, setEnabled] = useState(true)
  const [recipient, setRecipient] = useState('')
  const [weekday, setWeekday] = useState(0)
  const [hour, setHour] = useState(8)
  const [language, setLanguage] = useState('')

  function apply(next: WeeklyReportSettingsResponse) {
    setData(next)
    setEnabled(next.settings.enabled)
    setRecipient(next.settings.recipientEmail ?? '')
    setWeekday(next.settings.weekday)
    setHour(next.settings.hour)
    setLanguage(next.settings.language ?? '')
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await authFetch('/admin-api/weekly-report/settings')
        if (res.status === 403) {
          if (!cancelled) setForbidden(true)
          return
        }
        if (!res.ok) throw new Error(`Failed to load weekly report settings: ${res.status}`)
        const body = (await res.json()) as WeeklyReportSettingsResponse
        if (!cancelled) apply(body)
      } catch (error) {
        console.error('WeeklyReportSettingsCard load error:', error)
        if (!cancelled) setLoadError(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await authFetch('/admin-api/weekly-report/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          recipient_email: recipient.trim() === '' ? null : recipient.trim(),
          weekday,
          hour,
          language: language === '' ? null : language,
        }),
      })
      if (!res.ok) throw new Error(`Failed to save weekly report settings: ${res.status}`)
      apply((await res.json()) as WeeklyReportSettingsResponse)
      setMessage({ kind: 'ok', text: t('saved') })
    } catch (error) {
      console.error('WeeklyReportSettingsCard save error:', error)
      setMessage({ kind: 'error', text: t('saveFailed') })
    } finally {
      setSaving(false)
    }
  }

  if (forbidden) return null

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Mail className="h-5 w-5 text-blue-600" />
        {t('title')}
      </h2>
      <p className="text-sm text-gray-500 mb-4">{t('description')}</p>

      {loadError && <p className="text-sm text-red-600">{t('loadFailed')}</p>}
      {data && !data.available && <p className="text-sm text-amber-700 mb-4">{t('notAvailable')}</p>}

      {data && (
        <fieldset disabled={!data.available || saving} className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {t('enabled')}
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('recipient')}</label>
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t('recipientPlaceholder')}
              className={fieldClass}
            />
            {recipient.trim() === '' && (
              <p className="text-sm text-gray-500 mt-1">
                {t('recipientHint', { emails: data.ownerAdminEmails.join(', ') || '-' })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('weekday')}</label>
              <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className={fieldClass}>
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {t(`days.d${day}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('hour')}</label>
              <select value={hour} onChange={(e) => setHour(Number(e.target.value))} className={fieldClass}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={fieldClass}>
                <option value="">
                  {t('languageDefault')} ({LANGUAGE_NAMES[data.effectiveLanguage]})
                </option>
                {REPORT_LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {LANGUAGE_NAMES[code]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {t('save')}
            </button>
            {message && (
              <span className={message.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
                {message.text}
              </span>
            )}
          </div>
        </fieldset>
      )}
    </div>
  )
}
