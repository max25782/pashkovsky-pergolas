'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { authFetch } from '@/lib/api/auth-fetch'
import type { DealPriceSyncResult, EffectiveOffer } from '@/lib/deals/deal-price-sync'

type PriceState = DealPriceSyncResult & { effective: EffectiveOffer | null }

interface DealPriceSourceProps {
  dealId: string
  /** Bumped whenever the offers list changes, so the source line is re-read from the server. */
  refreshKey: number
  formatCurrency: (amount: number | null | undefined) => string
  /** The server amount moved (new/changed/deleted offer, or "update from offer" confirmed). */
  onServerPriceChange: (price: number | null) => void
}

/** Where the deal amount came from: «מהצעה 2026-0014» (link) or «ידני», plus the update button. */
export function DealPriceSource({ dealId, refreshKey, formatCurrency, onServerPriceChange }: DealPriceSourceProps) {
  const t = useTranslations('deals')
  const [state, setState] = useState<PriceState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastServerPrice = useRef<number | null | undefined>(undefined)
  const onChangeRef = useRef(onServerPriceChange)
  onChangeRef.current = onServerPriceChange

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/api/deals/${dealId}/price-sync`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const next = (await res.json()) as PriceState
      setState(next)
      setError(null)
      if (lastServerPrice.current !== undefined && lastServerPrice.current !== next.price) {
        onChangeRef.current(next.price)
      }
      lastServerPrice.current = next.price
    } catch (e) {
      console.error('[DealPriceSource] load failed:', dealId, e)
      setError(t('priceSourceLoadError'))
    }
  }, [dealId, t])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function updateFromOffer() {
    setBusy(true)
    setError(null)
    try {
      const res = await authFetch(`/api/deals/${dealId}/price-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      console.error('[DealPriceSource] update failed:', dealId, e)
      setError(t('priceSourceUpdateError'))
    } finally {
      setBusy(false)
    }
  }

  function scrollToOffer(offerId: string) {
    document.getElementById(`offer-${offerId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!state && !error) return null

  return (
    <div className="mt-2 space-y-1 text-sm" data-testid="deal-price-source">
      {state?.source === 'offer' && state.offerId && (
        <a
          href={`#offer-${state.offerId}`}
          onClick={(e) => {
            e.preventDefault()
            scrollToOffer(state.offerId as string)
          }}
          className="text-emerald-300 underline hover:text-emerald-200"
          data-testid="deal-price-source-offer"
        >
          {t('priceFromOffer', { number: state.offerNumber ?? state.offerId.slice(0, 8) })}
        </a>
      )}
      {state?.source === 'manual' && (
        <span
          className="inline-block rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-200"
          data-testid="deal-price-source-manual"
        >
          {t('priceManual')}
        </span>
      )}
      {state?.conflict && (
        <div className="flex flex-wrap items-center gap-2 text-amber-200/90">
          <span>
            {t('priceManualVsOffer', {
              number: state.conflict.offerNumber ?? state.conflict.offerId.slice(0, 8),
              amount: formatCurrency(state.conflict.proposed),
            })}
          </span>
          <button
            type="button"
            onClick={() => void updateFromOffer()}
            disabled={busy}
            className="rounded bg-amber-500/20 px-2 py-1 text-xs font-medium hover:bg-amber-500/30 disabled:opacity-50"
          >
            {t('priceUpdateFromOffer')}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
