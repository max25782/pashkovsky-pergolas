'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatCurrencyILS, calcProfit } from '@/lib/workers/calculations'
import { authFetch } from '@/lib/api/auth-fetch'

interface ProfitWidgetProps {
  projectId: string
  revenue: number // From offer.finalPrice or deal.revenueFinal
  materialCost?: number // my_cost from deal
  refreshTrigger?: number // Trigger to refresh shifts
}

export function ProfitWidget({ projectId, revenue, materialCost = 0, refreshTrigger = 0 }: ProfitWidgetProps) {
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
      <h3 className="text-xl font-bold text-white mb-4">רווח</h3>

      {loading ? (
        <div className="text-white/60 text-sm">מחשב...</div>
      ) : (
        <div className="space-y-4">
          {/* Revenue */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">הכנסות:</span>
            <span className="text-white font-semibold text-lg">
              {revenue > 0 ? formatCurrencyILS(revenue) : 'אין נתונים'}
            </span>
          </div>

          {/* Material Cost */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">מחיר החומר:</span>
            <span className="text-white font-semibold">
              {formatCurrencyILS(materialCost)}
            </span>
          </div>

          {/* Labor Cost */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">עלות עובדים:</span>
            <span className="text-white font-semibold">
              {formatCurrencyILS(laborCost)}
            </span>
          </div>

          {/* Total Cost */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">סה"כ עלויות:</span>
            <span className="text-white font-semibold">
              {formatCurrencyILS(materialCost + laborCost)}
            </span>
          </div>

          {/* Cost % */}
          {revenue > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">עלויות (% מההכנסות):</span>
              <span className="text-white/60">
                {(((materialCost + laborCost) / revenue) * 100).toFixed(1)}%
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/10 my-3" />

          {/* Profit */}
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold text-lg">רווח נקי:</span>
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
              שולי רווח:{' '}
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






