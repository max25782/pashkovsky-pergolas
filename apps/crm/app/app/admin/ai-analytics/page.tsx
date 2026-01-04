'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import type { AnalyticsContext } from '@/lib/ai/analyticsTypes'
import { authFetch } from '@/lib/api/auth-fetch'
import { createClient } from '@/lib/supabase/client'

type AnalyticsMode = 'leads' | 'deals' | 'finance' | 'manager'
type PeriodPreset = 'last7days' | 'last30days' | 'thismonth' | 'custom'

interface AnalyticsRequest {
  mode: AnalyticsMode
  period: {
    from: string
    to: string
  }
  question: string
}

interface AISuggestion {
  type: 'mark_stale' | 'follow_up'
  dealIds?: string[]
  leadIds?: string[]
  reason: string
}

interface AnalyticsResponse {
  answer: string
  context: AnalyticsContext
  suggestions?: AISuggestion[]
}

interface HistoryItem extends AnalyticsRequest {
  id: string
  timestamp: string
  answer: string
  context: AnalyticsContext
  suggestions?: AISuggestion[]
}

function getPeriodDates(preset: PeriodPreset, customFrom?: string, customTo?: string): { from: string; to: string } {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  switch (preset) {
    case 'last7days': {
      const from = new Date(today)
      from.setDate(from.getDate() - 7)
      return {
        from: from.toISOString().split('T')[0],
        to: todayStr,
      }
    }
    case 'last30days': {
      const from = new Date(today)
      from.setDate(from.getDate() - 30)
      return {
        from: from.toISOString().split('T')[0],
        to: todayStr,
      }
    }
    case 'thismonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
      return {
        from: from.toISOString().split('T')[0],
        to: todayStr,
      }
    }
    case 'custom': {
      return {
        from: customFrom || todayStr,
        to: customTo || todayStr,
      }
    }
  }
}

function extractKeyNumbers(context: AnalyticsContext): string[] {
  const numbers: string[] = []

  if (context.leads) {
    numbers.push(`Лидов: ${context.leads.totalLeads}`)
    numbers.push(`Новых: ${context.leads.newLeads}`)
    numbers.push(`Конверсия: ${context.leads.conversionRate}%`)
    if (context.leads.avgResponseTimeMinutes) {
      numbers.push(`Ср. время ответа: ${Math.round(context.leads.avgResponseTimeMinutes / 60)}ч`)
    }
  }

  if (context.deals) {
    numbers.push(`Сделок: ${context.deals.totalDeals}`)
    numbers.push(`Активных: ${context.deals.activeDeals}`)
    numbers.push(`Завершено: ${context.deals.completedDeals}`)
    if (context.deals.averageDealValue > 0) {
      numbers.push(`Ср. стоимость: ${context.deals.averageDealValue.toLocaleString()} ILS`)
    }
    numbers.push(`Win rate: ${context.deals.winRate}%`)
  }

  if (context.finance) {
    numbers.push(`Выручка: ${context.finance.totalRevenue.toLocaleString()} ILS`)
    numbers.push(`Затраты: ${context.finance.totalCosts.toLocaleString()} ILS`)
    numbers.push(`Прибыль: ${context.finance.totalProfit.toLocaleString()} ILS`)
    numbers.push(`Маржа: ${context.finance.profitMargin}%`)
  }

  return numbers
}

export default function AIAnalyticsPage() {
  const t = useCRMTranslations()
  
  // Analytics state
  const [mode, setMode] = useState<AnalyticsMode>('manager')
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('last30days')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<AnalyticsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [applyingSuggestion, setApplyingSuggestion] = useState<string | null>(null)

  useEffect(() => {
    // Load history from localStorage
    const storedHistory = localStorage.getItem('ai_analytics_history')
    if (storedHistory) {
      try {
        setHistory(JSON.parse(storedHistory))
      } catch (e) {
        console.error('Failed to load history:', e)
      }
    }
  }, [])

  async function handleAnalyze() {
    if (!question.trim()) {
      setError('Введите вопрос')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    const period = getPeriodDates(periodPreset, customFrom, customTo)

    try {
      const res = await authFetch('/api/ai/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          period,
          question: question.trim(),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data: AnalyticsResponse = await res.json()
      setResponse(data)

      // Save to history
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        mode,
        period,
        question: question.trim(),
        answer: data.answer,
        context: data.context,
        suggestions: data.suggestions,
      }

      const newHistory = [historyItem, ...history].slice(0, 20) // Keep last 20
      setHistory(newHistory)
      localStorage.setItem('ai_analytics_history', JSON.stringify(newHistory))
    } catch (err: any) {
      setError(err.message || 'Ошибка при анализе')
    } finally {
      setLoading(false)
    }
  }

  function loadFromHistory(item: HistoryItem) {
    setMode(item.mode)
    setQuestion(item.question)
    
    // Determine preset from dates
    const period = getPeriodDates('last30days')
    const itemFrom = new Date(item.period.from)
    const itemTo = new Date(item.period.to)
    const periodFrom = new Date(period.from)
    const periodTo = new Date(period.to)
    
    if (itemFrom.getTime() === periodFrom.getTime() && itemTo.getTime() === periodTo.getTime()) {
      setPeriodPreset('last30days')
    } else {
      setPeriodPreset('custom')
      setCustomFrom(item.period.from)
      setCustomTo(item.period.to)
    }
    
    setResponse({
      answer: item.answer,
      context: item.context,
      suggestions: item.suggestions,
    })
  }

  async function applySuggestion(suggestion: AISuggestion, index: number) {
    const suggestionId = `suggestion-${index}`
    setApplyingSuggestion(suggestionId)

    try {
      if (suggestion.type === 'mark_stale' && suggestion.dealIds) {
        // Update deals - add note about being stale
        for (const dealId of suggestion.dealIds) {
          await authFetch('/admin-api/deals', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: dealId,
              notes: `[AI] Помечено как устаревшее: ${suggestion.reason}\n${new Date().toLocaleDateString('ru-RU')}`,
            }),
          })
        }
      } else if (suggestion.type === 'follow_up' && suggestion.leadIds) {
        // Update leads - add note about follow-up needed
        for (const leadId of suggestion.leadIds) {
          await authFetch('/admin-api/leads', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: leadId,
              notes: `[AI] Требуется повторный контакт: ${suggestion.reason}\n${new Date().toLocaleDateString('ru-RU')}`,
            }),
          })
        }
      }

      // Remove applied suggestion from UI
      if (response) {
        const updatedSuggestions = response.suggestions?.filter((_, i) => i !== index)
        setResponse({
          ...response,
          suggestions: updatedSuggestions,
        })
      }
    } catch (err: any) {
      setError(`Ошибка при применении предложения: ${err.message}`)
    } finally {
      setApplyingSuggestion(null)
    }
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.clear()
    window.location.href = '/login'
  }

  const period = getPeriodDates(periodPreset, customFrom, customTo)

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">AI Аналитика</h1>
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
          <Link
            href="/app/admin/leads"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition font-semibold"
          >
            {t.common.logout}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mode tabs */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex gap-2 mb-4">
              {(['leads', 'deals', 'finance', 'manager'] as AnalyticsMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2 rounded font-semibold ${
                    mode === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {m === 'leads' ? 'Лиды' : m === 'deals' ? 'Сделки' : m === 'finance' ? 'Финансы' : 'Менеджер'}
                </button>
              ))}
            </div>

            {/* Period selection */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold">Период</label>
              <div className="flex gap-2 flex-wrap">
                {(['last7days', 'last30days', 'thismonth', 'custom'] as PeriodPreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodPreset(p)}
                    className={`px-3 py-1 rounded text-sm ${
                      periodPreset === p
                        ? 'bg-green-600 text-white'
                        : 'bg-white/10 hover:bg-white/20'
                    }`}
                  >
                    {p === 'last7days' ? '7 дней' : p === 'last30days' ? '30 дней' : p === 'thismonth' ? 'Этот месяц' : 'Свой'}
                  </button>
                ))}
              </div>

              {periodPreset === 'custom' && (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => setCustomFrom(e.target.value)}
                    className="px-3 py-2 rounded bg-black/40 border border-white/20 flex-1"
                  />
                  <span className="self-center">—</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={e => setCustomTo(e.target.value)}
                    className="px-3 py-2 rounded bg-black/40 border border-white/20 flex-1"
                  />
                </div>
              )}

              <div className="text-sm text-white/60">
                {period.from} — {period.to}
              </div>
            </div>
          </div>

          {/* Question input */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <label className="block text-sm font-semibold mb-2">Вопрос</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Например: Какие основные проблемы с лидами? Или: Какова динамика продаж?"
              className="w-full px-3 py-2 rounded bg-black/40 border border-white/20 min-h-[120px] resize-y"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !question.trim()}
              className="mt-3 px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Анализирую...' : 'Анализировать'}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-red-200">
              Ошибка: {error}
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Ответ AI</h2>
              <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                {response.answer}
              </div>

              {/* AI Suggestions */}
              {response.suggestions && response.suggestions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="text-lg font-semibold mb-3">Предложения AI</h3>
                  <div className="space-y-3">
                    {response.suggestions.map((suggestion, idx) => {
                      const suggestionId = `suggestion-${idx}`
                      const isApplying = applyingSuggestion === suggestionId
                      
                      return (
                        <div
                          key={idx}
                          className="bg-white/5 border border-white/10 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-semibold mb-1">
                                {suggestion.type === 'mark_stale' 
                                  ? 'Пометить как устаревшие' 
                                  : 'Требуется повторный контакт'}
                              </div>
                              <div className="text-sm text-white/80 mb-2">
                                {suggestion.reason}
                              </div>
                              <div className="text-xs text-white/60">
                                {suggestion.type === 'mark_stale' && suggestion.dealIds && (
                                  <>Сделок: {suggestion.dealIds.length}</>
                                )}
                                {suggestion.type === 'follow_up' && suggestion.leadIds && (
                                  <>Лидов: {suggestion.leadIds.length}</>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => applySuggestion(suggestion, idx)}
                              disabled={isApplying}
                              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              {isApplying ? 'Применяю...' : 'Применить'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 text-xs text-white/60">
                    Примечание: AI только предлагает действия. Выполнение происходит только после нажатия "Применить".
                  </div>
                </div>
              )}

              {/* Key numbers */}
              {response.context && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="text-sm font-semibold mb-3 text-white/60">
                    Данные, на основе которых считали:
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {extractKeyNumbers(response.context).map((num, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded bg-white/10 text-sm"
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: History */}
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h2 className="text-lg font-bold mb-4">История запросов</h2>
            {history.length === 0 ? (
              <div className="text-white/60 text-sm">Нет истории</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="w-full text-left p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition"
                  >
                    <div className="text-xs text-white/60 mb-1">
                      {new Date(item.timestamp).toLocaleString('ru-RU')}
                    </div>
                    <div className="text-xs font-semibold mb-1 capitalize">
                      {item.mode}
                    </div>
                    <div className="text-sm line-clamp-2">
                      {item.question}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

