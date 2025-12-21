'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import type { AnalyticsContext } from '@/lib/ai/analyticsTypes'

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

function extractKeyMetrics(context: AnalyticsContext): string[] {
  const metrics: string[] = []

  if (context.leads) {
    metrics.push(`Лидов: ${context.leads.totalLeads}`)
    metrics.push(`Квалифицированных: ${context.leads.qualifiedLeads}`)
    metrics.push(`Конверсия: ${context.leads.conversionRate}%`)
  }

  if (context.deals) {
    metrics.push(`Сделок: ${context.deals.totalDeals}`)
    metrics.push(`Активных: ${context.deals.activeDeals}`)
    metrics.push(`Завершено: ${context.deals.completedDeals}`)
    metrics.push(`Win rate: ${context.deals.winRate}%`)
  }

  if (context.finance) {
    metrics.push(`Выручка: ${context.finance.totalRevenue.toLocaleString()} ILS`)
    metrics.push(`Прибыль: ${context.finance.totalProfit.toLocaleString()} ILS`)
    metrics.push(`Маржа: ${context.finance.profitMargin}%`)
  }

  return metrics
}

export default function WeeklyDigestsPage({ params }: { params: { locale: Locale } }) {
  const t = useCRMTranslations()
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [digests, setDigests] = useState<WeeklyDigest[]>([])
  const [selectedDigest, setSelectedDigest] = useState<WeeklyDigest | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token')
    if (storedToken) {
      setToken(storedToken)
      loadDigests(storedToken)
    }
  }, [])

  async function loadDigests(adminToken: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/weekly-digest', {
        headers: {
          'x-admin-token': adminToken,
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setDigests(data.digests || [])
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки дайджестов')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    if (!token) return

    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/weekly-digest/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      
      // Reload digests
      await loadDigests(token)
      
      // Select newly generated digest
      if (data.digest) {
        const res2 = await fetch(`/api/reports/weekly-digest?id=${data.digest.id}`, {
          headers: {
            'x-admin-token': token,
          },
        })
        if (res2.ok) {
          const digestData = await res2.json()
          setSelectedDigest(digestData.digest)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка генерации дайджеста')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSelectDigest(digestId: string) {
    if (!token) return

    try {
      const res = await fetch(`/api/reports/weekly-digest?id=${digestId}`, {
        headers: {
          'x-admin-token': token,
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      setSelectedDigest(data.digest)
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки дайджеста')
    }
  }

  function save() {
    if (input.trim()) {
      localStorage.setItem('admin_token', input.trim())
      setToken(input.trim())
      loadDigests(input.trim())
    }
  }

  function logout() {
    localStorage.removeItem('admin_token')
    setToken(null)
    setInput('')
    setDigests([])
    setSelectedDigest(null)
  }

  if (!token) {
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Weekly Digests</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">{t.auth.enterAdminToken}</label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/20"
            placeholder={t.auth.adminTokenPlaceholder}
          />
          <button onClick={save} className="mt-3 px-4 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.continue}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Weekly Digests</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/${params.locale}/admin/deals`}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href={`/${params.locale}/admin/statistics`}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            {t.nav.statistic}
          </Link>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50"
          >
            {generating ? 'Генерирую...' : 'Сгенерировать сейчас'}
          </button>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
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
            <h2 className="text-lg font-bold mb-4">История дайджестов</h2>
            {loading ? (
              <div className="text-white/60 text-sm">Загрузка...</div>
            ) : digests.length === 0 ? (
              <div className="text-white/60 text-sm">Нет дайджестов</div>
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
                      {digest.status === 'failed' ? 'Ошибка' : 'Готово'}
                    </div>
                    {digest.createdAt && (
                      <div className="text-xs text-white/60">
                        {new Date(digest.createdAt).toLocaleDateString('ru-RU')}
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
                    Ошибка генерации
                  </span>
                )}
              </div>

              {selectedDigest.status === 'failed' ? (
                <div className="text-red-200">
                  {selectedDigest.errorMessage || 'Неизвестная ошибка'}
                </div>
              ) : (
                <>
                  {/* Key metrics */}
                  {selectedDigest.summaryJson && (
                    <div className="mb-6 pb-6 border-b border-white/10">
                      <h3 className="text-sm font-semibold mb-3 text-white/60">
                        Ключевые метрики:
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
              Выберите дайджест из списка для просмотра
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

