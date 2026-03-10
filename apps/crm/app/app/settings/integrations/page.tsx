'use client'

/**
 * Integrations Settings Page
 * Manage website integration status and request setup
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authFetch } from '@/lib/api/auth-fetch'
import type { CompanyIntegration, RequestSetupDTO } from '@/types/integration'

export default function IntegrationsSettingsPage() {
  const router = useRouter()
  const t = useTranslations('integrations')

  const [integration, setIntegration] = useState<CompanyIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<RequestSetupDTO>({
    website_url: '',
    form_plugin: '',
    notes: '',
    payment_method: 'bit',
  })
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadIntegration()
  }, [])

  async function loadIntegration() {
    try {
      const response = await authFetch('/api/integrations/me')
      if (!response.ok) {
        throw new Error('Failed to load integration')
      }
      const data = await response.json()
      setIntegration(data.integration)
      
      // Show form if no integration exists
      if (!data.integration) {
        setShowForm(true)
      }
    } catch (error) {
      console.error('[Integrations] Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    try {
      const response = await authFetch('/api/integrations/request-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit request')
      }

      const data = await response.json()
      setMessage({ type: 'success', text: t('setupRequested') })
      setShowForm(false)
      
      // Reload integration
      await loadIntegration()
    } catch (error: unknown) {
      setMessage({ type: 'error', text: (error instanceof Error ? error.message : String(error)) || 'Failed to submit request' })
    } finally {
      setSubmitting(false)
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-800'
      case 'suspended':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('close')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('title')}</h1>
          <p className="text-lg text-gray-600">{t('subtitle')}</p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Integration Status Card */}
        {integration ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(integration.status)}`}>
                {t(`status.${integration.status}`)}
              </span>
            </div>

            {integration.website_url && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">{t('websiteUrl')}</p>
                <p className="text-gray-900 font-mono text-sm">{integration.website_url}</p>
              </div>
            )}

            {integration.status === 'active' && (
              <div className="mt-6">
                <button
                  onClick={() => router.push('/app/settings/integrations/instructions')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('viewInstructions')}
                </button>
              </div>
            )}

            {integration.status === 'pending_payment' && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <p className="text-yellow-800 text-sm">{t('notAvailableForTrial')}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <p className="text-gray-600 mb-4">{t('integrationNotFound')}</p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('requestSetup')}
              </button>
            )}
          </div>
        )}

        {/* Request Setup Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('requestSetup')}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('websiteUrl')} *
                </label>
                <input
                  type="url"
                  required
                  value={formData.website_url}
                  onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                  placeholder={t('websiteUrlPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('formPlugin')}
                </label>
                <input
                  type="text"
                  value={formData.form_plugin}
                  onChange={(e) => setFormData({ ...formData, form_plugin: e.target.value })}
                  placeholder={t('formPluginPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('paymentMethod')} *
                </label>
                <select
                  required
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as 'bit' | 'paybox' | 'bank' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="bit">{t('paymentMethods.bit')}</option>
                  <option value="paybox">{t('paymentMethods.paybox')}</option>
                  <option value="bank">{t('paymentMethods.bank')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('notes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={t('notesPlaceholder')}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? t('close') : t('submit')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  {t('close')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
