'use client'

/**
 * Website Integrations Settings Page
 * Company-facing UI for managing website integrations
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '@/lib/language-context'
import { integrationsTranslations } from '@/lib/translations/integrations'
import { INTEGRATION_PRICING, formatPriceILS } from '@/lib/integrations/pricing'
import { authFetch } from '@/lib/api/auth-fetch'
import type { CompanyIntegration, RequestSetupDTO, PaymentInstructions } from '@/types/integration'
import type { SubscriptionPlan } from '@/types/subscription'

export default function IntegrationsPage() {
  const { language } = useLanguage()
  const t = integrationsTranslations[language]
  const dir = language === 'he' ? 'rtl' : 'ltr'

  const [integration, setIntegration] = useState<CompanyIntegration | null>(null)
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructions | null>(null)

  // Load data
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)

      // Get user company ID from auth
      const user = JSON.parse(localStorage.getItem('user') || '{}')
      const companyId = user.company_id || localStorage.getItem('company_id')

      if (!companyId) {
        console.error('[Integrations] No company ID found')
        return
      }

      // Fetch integration status
      const intResponse = await authFetch('/api/integrations/me')
      const intData = await intResponse.json()
      setIntegration(intData.integration)

      // Fetch current plan via API
      const planResponse = await authFetch('/api/subscriptions/current')
      const planData = await planResponse.json()
      setCurrentPlan(planData.plan || null)
    } catch (error) {
      console.error('[Integrations] Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestSetup(data: RequestSetupDTO) {
    try {
      const response = await authFetch('/api/integrations/request-setup', {
        method: 'POST',
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Request failed')
      }

      setPaymentInstructions(result.payment_instructions)
      setShowRequestModal(false)
      loadData() // Reload to show new status
    } catch (error: any) {
      console.error('[Integrations] Request error:', error)
      alert(error.message || 'Failed to request setup')
    }
  }

  // Check if plan allows integrations
  const canUseIntegrations = currentPlan && currentPlan.plan_key !== 'trial'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={dir}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8" dir={dir}>
      <div className="container mx-auto px-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.title}</h1>
          <p className="text-lg text-gray-600">{t.subtitle}</p>
        </div>

        {/* Trial Plan Message */}
        {!canUseIntegrations && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-900 mb-1">
                  {t.availableOnPaid}
                </h3>
                <p className="text-yellow-800">{t.notAvailableForTrial}</p>
              </div>
            </div>
          </div>
        )}

        {/* Integration Status Card */}
        {canUseIntegrations && integration && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{t.title}</h2>
              <StatusBadge status={integration.status} t={t} />
            </div>

            {integration.website_url && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">{t.websiteUrl}</p>
                <p className="text-gray-900 font-medium">{integration.website_url}</p>
              </div>
            )}

            {integration.last_event_at && (
              <div className="mb-4">
                <p className="text-sm text-gray-600">{t.lastLeadReceived}</p>
                <p className="text-gray-900">{formatRelativeTime(integration.last_event_at, language)}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {integration.status === 'active' && (
                <>
                  <button
                    onClick={() => window.location.href = '/app/settings/integrations/instructions'}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t.viewInstructions}
                  </button>
                  <button
                    onClick={() => alert('Test connection functionality coming soon')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    {t.testConnection}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pricing Packages - show also on Trial so user can upgrade */}
        {(!integration || integration.status === 'not_connected') && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.packages.basic.name}</h2>
            <p className="text-gray-600 mb-6">{t.oneTimeFee}</p>

            <div className="grid md:grid-cols-3 gap-6">
              {(Object.keys(INTEGRATION_PRICING) as Array<keyof typeof INTEGRATION_PRICING>).map((key) => {
                const pkg = INTEGRATION_PRICING[key]
                return (
                  <div
                    key={key}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {pkg.name[language]}
                    </h3>
                    <div className="text-3xl font-bold text-blue-600 mb-4">
                      {formatPriceILS(pkg.price_ils, language)}
                    </div>
                    <p className="text-gray-600 mb-4">{pkg.description[language]}</p>
                    <ul className="space-y-2 mb-6">
                      {pkg.features[language].map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={() => canUseIntegrations ? setShowRequestModal(true) : alert(t.notAvailableForTrial)}
                className={`px-8 py-3 rounded-lg transition-colors text-lg font-semibold ${
                  canUseIntegrations
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                }`}
              >
                {t.requestSetup}
              </button>
              {!canUseIntegrations && (
                <p className="text-sm text-gray-500 mt-3">
                  {t.availableOnPaid}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Payment Instructions */}
        {paymentInstructions && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">{t.payment.title}</h3>
            <div className="space-y-3 text-blue-800">
              {paymentInstructions.bit_phone && (
                <div>
                  <strong>{t.payment.bitPhone}:</strong> {paymentInstructions.bit_phone}
                </div>
              )}
              {paymentInstructions.paybox_link && (
                <div>
                  <strong>{t.payment.payboxLink}:</strong>{' '}
                  <a href={paymentInstructions.paybox_link} target="_blank" rel="noopener noreferrer" className="underline">
                    {paymentInstructions.paybox_link}
                  </a>
                </div>
              )}
              {paymentInstructions.bank_details && (
                <div>
                  <strong>{t.payment.bankDetails}:</strong>
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>{t.payment.bankName}: {paymentInstructions.bank_details.bank_name}</li>
                    <li>{t.payment.accountNumber}: {paymentInstructions.bank_details.account_number}</li>
                    <li>{t.payment.branch}: {paymentInstructions.bank_details.branch}</li>
                  </ul>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-blue-300">
                <strong>{t.payment.paymentNote}:</strong> {paymentInstructions.payment_note_template}
              </div>
            </div>
          </div>
        )}

        {/* Request Setup Modal */}
        {showRequestModal && (
          <RequestSetupModal
            onClose={() => setShowRequestModal(false)}
            onSubmit={handleRequestSetup}
            t={t}
          />
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status, t }: { status: string; t: any }) {
  const colors = {
    not_connected: 'bg-gray-100 text-gray-700',
    pending_payment: 'bg-yellow-100 text-yellow-700',
    active: 'bg-green-100 text-green-700',
    suspended: 'bg-red-100 text-red-700',
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
      {t.status[status as keyof typeof t.status] || status}
    </span>
  )
}

function RequestSetupModal({ onClose, onSubmit, t }: { onClose: () => void; onSubmit: (data: RequestSetupDTO) => void; t: any }) {
  const [formData, setFormData] = useState({
    website_url: '',
    form_plugin: '',
    notes: '',
    payment_method: 'bit' as 'bit' | 'paybox' | 'bank',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{t.requestSetup}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.websiteUrl}
            </label>
            <input
              type="url"
              required
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              placeholder={t.websiteUrlPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.formPlugin}
            </label>
            <input
              type="text"
              value={formData.form_plugin}
              onChange={(e) => setFormData({ ...formData, form_plugin: e.target.value })}
              placeholder={t.formPluginPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.paymentMethod}
            </label>
            <select
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="bit">{t.paymentMethods.bit}</option>
              <option value="paybox">{t.paymentMethods.paybox}</option>
              <option value="bank">{t.paymentMethods.bank}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.notes}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={t.notesPlaceholder}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {t.submit}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              {t.close}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function formatRelativeTime(dateStr: string, locale: 'en' | 'he' | 'ru'): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return locale === 'he' ? 'זה עתה' : locale === 'ru' ? 'только что' : 'just now'
  if (diffMins < 60) return `${diffMins} ${locale === 'he' ? 'דקות' : locale === 'ru' ? 'минут' : 'minutes'} ${locale === 'he' ? 'לפני' : locale === 'ru' ? 'назад' : 'ago'}`
  if (diffHours < 24) return `${diffHours} ${locale === 'he' ? 'שעות' : locale === 'ru' ? 'часов' : 'hours'} ${locale === 'he' ? 'לפני' : locale === 'ru' ? 'назад' : 'ago'}`
  if (diffDays < 7) return `${diffDays} ${locale === 'he' ? 'ימים' : locale === 'ru' ? 'дней' : 'days'} ${locale === 'he' ? 'לפני' : locale === 'ru' ? 'назад' : 'ago'}`

  return date.toLocaleDateString(locale === 'he' ? 'he-IL' : locale === 'ru' ? 'ru-RU' : 'en-US')
}

