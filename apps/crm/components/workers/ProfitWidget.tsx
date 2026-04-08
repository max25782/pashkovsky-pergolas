'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatCurrencyILS, calcProfit } from '@/lib/workers/calculations'
import { authFetch } from '@/lib/api/auth-fetch'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

interface ProfitWidgetProps {
  projectId: string
  revenue: number // From offer.finalPrice or deal.revenueFinal
  materialCost?: number // my_cost from deal
  refreshTrigger?: number // Trigger to refresh shifts
}

export function ProfitWidget({ projectId, revenue, materialCost = 0, refreshTrigger = 0 }: ProfitWidgetProps) {
  const t = useCRMTranslations()
  const [laborCost, setLaborCost] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchLabor = useCallback(async () => {
    try {
      setLoading(true)
      const response = await authFetch(`/api/deals/${projectId}/labor`)
      if (!response.ok) return
      const { totalCost } = await response.json()
      setLaborCost(totalCost ?? 0)
    } catch (err) {
      console.error('Error fetching labor for profit:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchLabor()
  }, [fetchLabor, refreshTrigger])

  const profit = calcProfit(revenue, laborCost, materialCost)
  const laborCostPercent = revenue > 0 ? (laborCost / revenue) * 100 : 0

  return (
    <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 rounded-lg p-6 border border-green-500/20">
      <h3 className="text-xl font-bold text-white mb-4">{t.deals.profit}</h3>

      {loading ? (
        <div className="text-white/60 text-sm">{t.deals.calculating}</div>
      ) : (
        <div className="space-y-4">
          {/* Revenue */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">{t.deals.revenue}:</span>
            <span className="text-white font-semibold text-lg">
              {revenue > 0 ? formatCurrencyILS(revenue) : t.deals.noData}
            </span>
          </div>

          {/* Material Cost */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">{t.deals.materialCost}:</span>
            <span className="text-white font-semibold">
              {formatCurrencyILS(materialCost)}
            </span>
          </div>

          {/* Labor Cost */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">{t.deals.laborCost}:</span>
            <span className="text-white font-semibold">
              {formatCurrencyILS(laborCost)}
            </span>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">{t.deals.totalCosts}:</span>
            <span className="text-white font-semibold">
              {formatCurrencyILS(materialCost + laborCost)}
            </span>
          </div>

          {/* Cost % */}
          {revenue > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">{t.deals.costsPercent}:</span>
              <span className="text-white/60">
                {(((materialCost + laborCost) / revenue) * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/10 my-3" />

          {/* Profit */}
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold text-lg">{t.deals.netProfit}:</span>
            <span
              className={`text-2xl font-bold ${
                profit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatCurrencyILS(profit)}
            </span>
          </div>

          {/* Profit Margin */}
          {revenue > 0 && (
            <div className="text-sm text-white/60 text-right">
              {t.deals.profitMargin}:{' '}
              <span
                className={`font-semibold ${
                  profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {((profit / revenue) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}






