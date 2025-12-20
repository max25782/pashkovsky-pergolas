'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatCurrencyILS, calculateProjectProfit } from '@/lib/workers/calculations'
import type { WorkShift } from '@/types/workers'

interface ProfitWidgetProps {
  projectId: string
  revenue: number // From offer.finalPrice or deal.revenueFinal
}

export function ProfitWidget({ projectId, revenue }: ProfitWidgetProps) {
  const [shifts, setShifts] = useState<WorkShift[]>([])
  const [loading, setLoading] = useState(false)

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/work-shifts?projectId=${projectId}`)
      if (!response.ok) return
      const { shifts: shiftsData } = await response.json()
      setShifts(shiftsData || [])
    } catch (err) {
      console.error('Error fetching shifts for profit:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const profit = calculateProjectProfit(revenue, shifts)

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

          {/* Labor Cost */}
          <div className="flex items-center justify-between">
            <span className="text-white/80">עלות עובדים:</span>
            <span className="text-white font-semibold">
              {formatCurrencyILS(profit.laborCost)}
            </span>
          </div>

          {/* Labor Cost % */}
          {revenue > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">עלות עובדים (% מההכנסות):</span>
              <span className="text-white/60">
                {profit.laborCostPercent.toFixed(1)}%
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
                profit.profit >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {formatCurrencyILS(profit.profit)}
            </span>
          </div>

          {/* Profit Margin */}
          {revenue > 0 && (
            <div className="text-sm text-white/60 text-right">
              שולי רווח:{' '}
              <span
                className={`font-semibold ${
                  profit.profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {((profit.profit / revenue) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}




