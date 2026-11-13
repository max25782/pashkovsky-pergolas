'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { DEFAULT_VAT_PERCENT } from '@/lib/deals/deal-finance'
import type { DealFinanceContext } from '@/lib/deals/deal-profit'

/**
 * VAT rate and per-deal labor cost for the kanban cards and the statistics.
 * `isReady` is false until the server answered: until then the VAT lines are
 * hidden rather than computed from a guessed rate.
 */
export function useDealFinanceContext(): DealFinanceContext & { isReady: boolean } {
  const [state, setState] = useState<DealFinanceContext & { isReady: boolean }>({
    vatPercent: DEFAULT_VAT_PERCENT,
    laborByDeal: {},
    isReady: false,
  })

  useEffect(() => {
    let cancelled = false
    authFetch('/admin-api/deals/finance-context')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { vatPercent?: number; laborByDeal?: Record<string, number> } | null) => {
        if (cancelled || !data || typeof data.vatPercent !== 'number') return
        setState({
          vatPercent: data.vatPercent,
          laborByDeal: data.laborByDeal ?? {},
          isReady: true,
        })
      })
      .catch(() => {
        // Stay not-ready: the VAT lines simply do not render.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
