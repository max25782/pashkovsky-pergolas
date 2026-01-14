'use client'

/**
 * Integration Instructions Page
 * Shows webhook URL, secret, and implementation examples
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/language-context'
import { integrationsTranslations } from '@/lib/translations/integrations'
import { authFetch } from '@/lib/api/auth-fetch'
import type { CompanyIntegration } from '@/types/integration'

export default function IntegrationInstructionsPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const t = integrationsTranslations[language]
  const dir = language === 'he' ? 'rtl' : 'ltr'

  const [integration, setIntegration] = useState<CompanyIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    loadIntegration()
  }, [])

  async function loadIntegration() {
    try {
      const response = await authFetch('/api/integrations/me')
      const data = await response.json()
      setIntegration(data.integration)
    } catch (error) {
      console.error('[Instructions] Load error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

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

  if (!integration) {
    return (
      <div className="min-h-screen bg-gray-50 py-8" dir={dir}>
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">{t.integrationNotFound}</p>
            <button
              onClick={() => router.push('/app/settings/integrations')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Integrations
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (integration.status !== 'active') {
    return (
      <div className="min-h-screen bg-gray-50 py-8" dir={dir}>
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800">{t.activateToSeeSecret}</p>
            <button
              onClick={() => router.push('/app/settings/integrations')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Integrations
            </button>
          </div>
        </div>
      </div>
    )
  }

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/integrations/webhook/leads`
  const examplePayload = {
    name: 'John Doe',
    phone: '+972501234567',
    email: 'john@example.com',
    message: 'I would like to get a quote',
    source_url: 'https://example.com/contact',
    utm: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'spring2024',
    },
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8" dir={dir}>
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/app/settings/integrations')}
            className="text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t.instructionsTitle}</h1>
          <p className="text-lg text-gray-600">Complete integration guide for your website</p>
        </div>

        {/* Webhook URL */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.instructions.webhookUrl}</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm break-all relative">
            {webhookUrl}
            <button
              onClick={() => copyToClipboard(webhookUrl, 'url')}
              className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
            >
              {copied === 'url' ? '✓ Copied' : t.copyUrl}
            </button>
          </div>
        </div>

        {/* Webhook Secret */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.instructions.webhookSecret}</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm break-all relative">
            {integration.webhook_secret}
            <button
              onClick={() => copyToClipboard(integration.webhook_secret, 'secret')}
              className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
            >
              {copied === 'secret' ? '✓ Copied' : t.copyToken}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Keep this secret secure. Do not share it publicly.
          </p>
        </div>

        {/* Required Headers */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.instructions.requiredHeaders}</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
            <div>Content-Type: application/json</div>
            <div className="text-blue-600">x-alumin-signature: YOUR_HMAC_SHA256_SIGNATURE</div>
          </div>
        </div>

        {/* Example Payload */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.instructions.examplePayload}</h2>
          <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
            {JSON.stringify(examplePayload, null, 2)}
          </pre>
        </div>

        {/* Signature Generation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.instructions.signatureGeneration}</h2>
          <p className="text-gray-600 mb-4">{t.instructions.signatureExplanation}</p>

          <div className="space-y-4">
            {/* Node.js Example */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Node.js Example:</h3>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
{`const crypto = require('crypto');

const payload = JSON.stringify({
  name: 'John Doe',
  phone: '+972501234567',
  // ... rest of your payload
});

const secret = '${integration.webhook_secret.substring(0, 16)}...';

const signature = crypto
  .createHmac('sha256', secret)
  .update(payload, 'utf8')
  .digest('hex');

// Send with header:
// x-alumin-signature: \${signature}`}
              </pre>
            </div>

            {/* PHP Example */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">PHP Example:</h3>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
{`<?php
$payload = json_encode([
    'name' => 'John Doe',
    'phone' => '+972501234567',
    // ... rest of your payload
]);

$secret = '${integration.webhook_secret.substring(0, 16)}...';
$signature = hash_hmac('sha256', $payload, $secret);

// Send with header:
// x-alumin-signature: $signature
?>`}
              </pre>
            </div>

            {/* Python Example */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Python Example:</h3>
              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
{`import hmac
import hashlib
import json

payload = json.dumps({
    'name': 'John Doe',
    'phone': '+972501234567',
    # ... rest of your payload
})

secret = '${integration.webhook_secret.substring(0, 16)}...'
signature = hmac.new(
    secret.encode('utf-8'),
    payload.encode('utf-8'),
    hashlib.sha256
).hexdigest()

# Send with header:
# x-alumin-signature: {signature}`}
              </pre>
            </div>
          </div>
        </div>

        {/* Test Webhook Button */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Ready to test?</h3>
          <p className="text-blue-800 mb-4">
            Use the examples above to send a test lead from your website or use tools like Postman.
          </p>
          <p className="text-sm text-blue-700">
            Check your CRM leads page after sending a test to verify it worked!
          </p>
        </div>
      </div>
    </div>
  )
}




