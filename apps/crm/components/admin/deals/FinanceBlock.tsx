'use client'

import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { authFetch } from '@/lib/api/auth-fetch'

export interface FinanceBlockLabels {
  clientPrice: string
  /** Editable deal field (typically material + direct). */
  totalCosts: string
  profit: string
  margin: string
  warnNoCostsYet: string
  warnAddPriceCosts: string
  warnZeroCostsNoMargin: string
  placeholderPrice: string
  placeholderCosts: string
  costBreakdownTitle: string
  laborFromShifts: string
  materialOrdersFromSystem: string
  /** Template with literal `{count}` for order count suffix. */
  materialOrdersOrderCountTemplate: string
  noMaterialOrdersDash: string
  totalInternalForProfit: string
  loadingBreakdown: string
  /** Footnote under breakdown: how profit is computed vs material orders. */
  financeProfitFootnote: string
}

interface FinanceBlockProps {
  clientPrice: number | null | undefined
  totalCosts: number | null | undefined
  onClientPriceChange: (value: number | null) => void
  onTotalCostsChange: (value: number | null) => void
  formatCurrency: (amount: number) => string
  labels: FinanceBlockLabels
  className?: string
  /** When set, loads labor + material orders for the breakdown and profit total. */
  dealId?: string
  /** Increment when shifts or orders change so totals refetch. */
  breakdownRefreshKey?: number
}

function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number.parseFloat(trimmed.replace(',', '.'))
  if (!Number.isFinite(n)) return null
  return n
}

export function FinanceBlock({
  clientPrice,
  totalCosts,
  onClientPriceChange,
  onTotalCostsChange,
  formatCurrency,
  labels,
  className,
  dealId,
  breakdownRefreshKey = 0,
}: FinanceBlockProps) {
  const priceNum = clientPrice != null && Number.isFinite(clientPrice) ? clientPrice : null
  const costsNum = totalCosts != null && Number.isFinite(totalCosts) ? totalCosts : null
  const materialInput = costsNum ?? 0

  const [laborTotal, setLaborTotal] = useState(0)
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersCount, setOrdersCount] = useState(0)
  const [breakdownLoading, setBreakdownLoading] = useState(false)

  useEffect(() => {
    if (dealId == null || dealId === '') {
      setLaborTotal(0)
      setOrdersTotal(0)
      setOrdersCount(0)
      return
    }
    const safeDealId: string = dealId
    let cancelled = false
    async function load() {
      setBreakdownLoading(true)
      try {
        const [laborRes, ordersRes] = await Promise.all([
          authFetch(`/api/deals/${safeDealId}/labor`),
          authFetch(`/api/material-orders?dealId=${encodeURIComponent(safeDealId)}`),
        ])
        let labor = 0
        if (!cancelled && laborRes.ok) {
          const laborJson = (await laborRes.json()) as { totalCost?: number }
          labor = Number(laborJson.totalCost ?? 0)
        }
        let ordTotal = 0
        let ordCount = 0
        if (!cancelled && ordersRes.ok) {
          const ordersJson = (await ordersRes.json()) as {
            orders?: Array<{ total_price?: number | null; status?: string | null }>
          }
          for (const o of ordersJson.orders ?? []) {
            if (o.status === 'cancelled') continue
            ordCount += 1
            const row = o.total_price != null ? Number(o.total_price) : 0
            if (Number.isFinite(row)) ordTotal += row
          }
        }
        if (!cancelled) {
          setLaborTotal(labor)
          setOrdersTotal(ordTotal)
          setOrdersCount(ordCount)
        }
      } catch {
        if (!cancelled) {
          setLaborTotal(0)
          setOrdersTotal(0)
          setOrdersCount(0)
        }
      } finally {
        if (!cancelled) setBreakdownLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [dealId, breakdownRefreshKey])

  const totalInternalForProfit = materialInput + laborTotal

  const { profit, marginPercent, mode } = useMemo(() => {
    const hasMaterialField = costsNum != null && costsNum > 0
    const hasInternalOutflows = totalInternalForProfit > 0

    if (priceNum == null && !hasMaterialField && laborTotal === 0) {
      return { profit: null as number | null, marginPercent: null as number | null, mode: 'empty' as const }
    }
    if (priceNum == null && (hasMaterialField || laborTotal > 0)) {
      return { profit: null, marginPercent: null, mode: 'costs_only' as const }
    }
    if (priceNum != null && !hasInternalOutflows) {
      return { profit: null, marginPercent: null, mode: 'price_only' as const }
    }
    if (priceNum != null && hasInternalOutflows) {
      const p = priceNum - totalInternalForProfit
      const m = priceNum > 0 ? (p / priceNum) * 100 : null
      return { profit: p, marginPercent: m, mode: 'ok' as const }
    }
    return { profit: null, marginPercent: null, mode: 'empty' as const }
  }, [priceNum, costsNum, laborTotal, totalInternalForProfit])

  const inputClass =
    'w-full rounded-xl border border-emerald-500/30 bg-black/20 px-4 py-3 text-lg text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30'

  return (
    <section
      className={clsx(
        'rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 p-5 shadow-lg shadow-emerald-900/20',
        className,
      )}
      aria-label={labels.profit}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-200/90">{labels.profit}</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/80">{labels.clientPrice}</label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={priceNum != null ? String(priceNum) : ''}
            onChange={(e) => onClientPriceChange(parseMoneyInput(e.target.value))}
            className={inputClass}
            placeholder={labels.placeholderPrice}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-white/80">{labels.totalCosts}</label>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={costsNum != null ? String(costsNum) : ''}
            onChange={(e) => onTotalCostsChange(parseMoneyInput(e.target.value))}
            className={inputClass}
            placeholder={labels.placeholderCosts}
          />
        </div>
      </div>

      {dealId && (
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-black/25 px-4 py-3 text-sm text-white/85">
          <div className="mb-2 font-semibold text-emerald-100/90">{labels.costBreakdownTitle}</div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
              <span className="text-white/70">{labels.laborFromShifts}</span>
              <span className="tabular-nums font-medium text-white">
                {breakdownLoading ? labels.loadingBreakdown : formatCurrency(laborTotal)}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
              <span className="text-white/70">{labels.materialOrdersFromSystem}</span>
              <span className="tabular-nums font-medium text-white">
                {breakdownLoading ? (
                  labels.loadingBreakdown
                ) : ordersCount > 0 ? (
                  <>
                    {formatCurrency(ordersTotal)}
                    <span className="ms-1 text-xs text-white/45">
                      {labels.materialOrdersOrderCountTemplate.replace('{count}', String(ordersCount))}
                    </span>
                  </>
                ) : (
                  <span className="text-white/40">{labels.noMaterialOrdersDash}</span>
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-emerald-100/95">
              <span className="font-semibold">{labels.totalInternalForProfit}</span>
              <span className="tabular-nums font-bold">
                {breakdownLoading ? labels.loadingBreakdown : formatCurrency(totalInternalForProfit)}
              </span>
            </div>
            <p className="pt-1 text-xs leading-snug text-white/40">{labels.financeProfitFootnote}</p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 sm:p-5">
        {mode === 'empty' && (
          <p className="text-center text-base text-amber-200/95">{labels.warnAddPriceCosts}</p>
        )}

        {mode === 'price_only' && (
          <p className="text-center text-base text-amber-200">
            {costsNum == null ? labels.warnNoCostsYet : labels.warnZeroCostsNoMargin}
          </p>
        )}

        {mode === 'ok' && profit != null && (
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between sm:gap-6">
            <div className="text-center sm:text-start">
              <div className="text-sm font-medium text-white/60">{labels.profit}</div>
              <div
                className={clsx(
                  'text-4xl font-extrabold tabular-nums sm:text-5xl',
                  profit >= 0 ? 'text-emerald-300' : 'text-rose-300',
                )}
              >
                {formatCurrency(profit)}
              </div>
            </div>
            {marginPercent != null && (
              <div className="rounded-lg bg-white/5 px-4 py-2 text-center sm:text-end">
                <div className="text-xs font-medium uppercase tracking-wide text-white/50">{labels.margin}</div>
                <div className="text-2xl font-bold tabular-nums text-emerald-200">{marginPercent.toFixed(1)}%</div>
              </div>
            )}
          </div>
        )}

        {mode === 'costs_only' && (
          <p className="text-center text-sm text-amber-200">{labels.warnAddPriceCosts}</p>
        )}
      </div>
    </section>
  )
}
