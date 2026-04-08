'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useTranslations } from 'next-intl'
import type { AnalyticsContext } from '@/lib/ai/analyticsTypes'
import { authFetch } from '@/lib/api/auth-fetch'

interface WeeklyDigest {
  id: string
  companyId: string | null
  periodFrom: string
  periodTo: string
  summaryJson: AnalyticsContext
  aiText: string
  status: 'generated' | 'failed'
  errorMessage?: string
  createdAt?: string
}

function useExtractKeyMetrics() {
  const tWeekly = useTranslations('reports.weekly')

  return function extractKeyMetrics(context: AnalyticsContext): string[] {
    const metrics: string[] = []

    if (context.leads) {
      metrics.push(tWeekly('metricsLeads', { count: context.leads.totalLeads }))
      metrics.push(tWeekly('metricsQualified', { count: context.leads.qualifiedLeads }))
      metrics.push(tWeekly('metricsConversion', { rate: context.leads.conversionRate }))
    }

    if (context.deals) {
      metrics.push(tWeekly('metricsDeals', { count: context.deals.totalDeals }))
      metrics.push(tWeekly('metricsActive', { count: context.deals.activeDeals }))
      metrics.push(tWeekly('metricsCompleted', { count: context.deals.completedDeals }))
      metrics.push(tWeekly('metricsWinRate', { rate: context.deals.winRate }))
    }

    if (context.finance) {
      metrics.push(tWeekly('metricsRevenue', { amount: context.finance.totalRevenue.toLocaleString() }))
      metrics.push(tWeekly('metricsProfit', { amount: context.finance.totalProfit.toLocaleString() }))
      metrics.push(tWeekly('metricsMargin', { rate: context.finance.profitMargin }))
    }

    return metrics
  }
}

export default function WeeklyDigestsPage() {
  const t = useCRMTranslations()
  const tWeekly = useTranslations('reports.weekly')
  const extractKeyMetrics = useExtractKeyMetrics()
  const [digests, setDigests] = useState<WeeklyDigest[]>([])
  const [selectedDigest, setSelectedDigest] = useState<WeeklyDigest | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDigests()
  }, [])

  async function loadDigests() {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/reports/weekly-digest')

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setDigests(data.digests || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tWeekly('errorLoadingDigests'))
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await authFetch('/api/reports/weekly-digest/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      
      // Reload digests
      await loadDigests()
      
      // Select newly generated digest
      if (data.digest) {
        const res2 = await authFetch(`/api/reports/weekly-digest?id=${data.digest.id}`)
        if (res2.ok) {
          const digestData = await res2.json()
          setSelectedDigest(digestData.digest)
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tWeekly('errorGenerating'))
    } finally {
      setGenerating(false)
    }
  }

  async function handleSelectDigest(digestId: string) {
    try {
      const res = await authFetch(`/api/reports/weekly-digest?id=${digestId}`)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setSelectedDigest(data.digest)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tWeekly('errorLoadingDigest'))
    }
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{tWeekly('title')}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app/admin/deals"
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href="/app/admin/statistics"
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            {t.nav.statistic}
          </Link>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50"
          >
            {generating ? tWeekly('generating') : tWeekly('generateNow')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Digest list */}
        <div className="lg:col-span-1">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h2 className="text-lg font-bold mb-4">{tWeekly('history')}</h2>
            {loading ? (
              <div className="text-white/60 text-sm">{tWeekly('loading')}</div>
            ) : digests.length === 0 ? (
              <div className="text-white/60 text-sm">{tWeekly('noDigests')}</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {digests.map((digest) => (
                  <button
                    key={digest.id}
                    onClick={() => handleSelectDigest(digest.id)}
                    className={`w-full text-left p-3 rounded border transition ${
                      selectedDigest?.id === digest.id
                        ? 'bg-blue-600/20 border-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-xs text-white/60 mb-1">
                      {digest.periodFrom} — {digest.periodTo}
                    </div>
                    <div className={`text-xs font-semibold mb-1 ${
                      digest.status === 'failed' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {digest.status === 'failed' ? tWeekly('failed') : tWeekly('done')}
                    </div>
                    {digest.createdAt && (
                      <div className="text-xs text-white/60">
                        {new Date(digest.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Digest content */}
        <div className="lg:col-span-2">
          {selectedDigest ? (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  Weekly Digest: {selectedDigest.periodFrom} — {selectedDigest.periodTo}
                </h2>
                {selectedDigest.status === 'failed' && (
                  <span className="px-3 py-1 rounded bg-red-900/30 text-red-200 text-sm">
                    {tWeekly('generationFailed')}
                  </span>
                )}
              </div>

              {selectedDigest.status === 'failed' ? (
                <div className="text-red-200">
                  {selectedDigest.errorMessage || tWeekly('unknownError')}
                </div>
              ) : (
                <>
                  {/* Key metrics */}
                  {selectedDigest.summaryJson && (
                    <div className="mb-6 pb-6 border-b border-white/10">
                      <h3 className="text-sm font-semibold mb-3 text-white/60">
                        {tWeekly('keyMetrics')}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {extractKeyMetrics(selectedDigest.summaryJson).map((metric, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded bg-white/10 text-sm"
                          >
                            {metric}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI text */}
                  <div className="prose prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-white/90">
                      {selectedDigest.aiText}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-center text-white/60">
              {tWeekly('selectDigest')}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

