'use client'

import { useState } from 'react'
import type { Lead } from './lead-types'

interface LeadScoreProps {
  lead: Lead
  adminToken: string
  onScoreUpdated?: (lead: Lead) => void
}

function getScoreCategory(score: number): string {
  if (score >= 80) return 'Hot'
  if (score >= 50) return 'Warm'
  return 'Cold'
}

export function LeadScore({ lead, adminToken, onScoreUpdated }: LeadScoreProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRescore() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/leads/${lead.id}/score`, {
        method: 'POST',
        headers: {
          'x-admin-token': adminToken,
        },
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = await res.json()

      // Update lead with new score
      const updatedLead: Lead = {
        ...lead,
        score: data.finalScore,
        score_updated_at: new Date().toISOString(),
        score_breakdown_json: {
          ruleScore: data.ruleScore,
          aiDelta: data.aiDelta,
          reasons: data.reasons,
          aiReasons: data.aiReasons,
          suggestedNextAction: data.suggestedNextAction,
        },
      }

      if (onScoreUpdated) {
        onScoreUpdated(updatedLead)
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка пересчёта скора')
    } finally {
      setLoading(false)
    }
  }

  const score = lead.score
  const breakdown = lead.score_breakdown_json

  if (score === null || score === undefined) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">AI Score</h3>
          <button
            onClick={handleRescore}
            disabled={loading}
            className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {loading ? 'Считаю...' : 'Рассчитать'}
          </button>
        </div>
        {error && (
          <div className="text-xs text-red-400 mt-2">{error}</div>
        )}
      </div>
    )
  }

  const category = getScoreCategory(score)

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">AI Score</h3>
        <button
          onClick={handleRescore}
          disabled={loading}
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-sm disabled:opacity-50"
        >
          {loading ? 'Пересчитываю...' : 'Пересчитать'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-2">{error}</div>
      )}

      <div className="mb-3">
        <div className="text-2xl font-bold">
          {score} <span className="text-sm font-normal text-white/60">({category})</span>
        </div>
        {breakdown && (
          <div className="text-xs text-white/60 mt-1">
            Правила: {breakdown.ruleScore} {breakdown.aiDelta !== 0 && (
              <span className={breakdown.aiDelta > 0 ? 'text-green-400' : 'text-red-400'}>
                {breakdown.aiDelta > 0 ? '+' : ''}{breakdown.aiDelta} AI
              </span>
            )}
          </div>
        )}
      </div>

      {breakdown && (
        <>
          {/* Rule reasons */}
          {breakdown.reasons && breakdown.reasons.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-white/60 mb-1">Причины (правила):</div>
              <ul className="text-xs space-y-1">
                {breakdown.reasons.map((reason, idx) => (
                  <li key={idx} className="text-white/80">• {reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI reasons */}
          {breakdown.aiReasons && breakdown.aiReasons.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-white/60 mb-1">Причины (AI):</div>
              <ul className="text-xs space-y-1">
                {breakdown.aiReasons.map((reason, idx) => (
                  <li key={idx} className="text-white/80">• {reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested action */}
          {breakdown.suggestedNextAction && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="text-xs font-semibold text-white/60 mb-1">Рекомендация:</div>
              <div className="text-sm text-green-300">{breakdown.suggestedNextAction}</div>
            </div>
          )}
        </>
      )}

      {lead.score_updated_at && (
        <div className="text-xs text-white/40 mt-2">
          Обновлено: {new Date(lead.score_updated_at).toLocaleString('ru-RU')}
        </div>
      )}
    </div>
  )
}

