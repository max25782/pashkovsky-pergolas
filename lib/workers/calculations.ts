/**
 * Helper functions for Workers and Work Shifts calculations
 */

import type { WorkShift, WorkShiftGroupedByDate, ProjectProfit } from '@/types/workers'

/**
 * Calculate total labor cost from work shifts
 */
export function calcLaborCost(shifts: WorkShift[]): number {
  return shifts.reduce((total, shift) => total + shift.dailyRateSnapshot, 0)
}

/**
 * Calculate profit from revenue and labor cost
 */
export function calcProfit(revenue: number, laborCost: number): number {
  return revenue - laborCost
}

/**
 * Group work shifts by date
 */
export function groupShiftsByDate(shifts: WorkShift[]): WorkShiftGroupedByDate[] {
  const grouped = new Map<string, WorkShift[]>()

  // Group by date
  for (const shift of shifts) {
    const date = shift.date
    if (!grouped.has(date)) {
      grouped.set(date, [])
    }
    grouped.get(date)!.push(shift)
  }

  // Convert to array and calculate totals
  return Array.from(grouped.entries())
    .map(([date, dateShifts]) => ({
      date,
      shifts: dateShifts.sort((a, b) => {
        // Sort by worker name if available
        const nameA = a.worker ? `${a.worker.firstName} ${a.worker.lastName}` : ''
        const nameB = b.worker ? `${b.worker.firstName} ${b.worker.lastName}` : ''
        return nameA.localeCompare(nameB)
      }),
      totalDailyRate: calcLaborCost(dateShifts),
    }))
    .sort((a, b) => b.date.localeCompare(a.date)) // Newest first
}

/**
 * Calculate project profit
 */
export function calculateProjectProfit(revenue: number, shifts: WorkShift[]): ProjectProfit {
  const laborCost = calcLaborCost(shifts)
  const profit = calcProfit(revenue, laborCost)
  const laborCostPercent = revenue > 0 ? (laborCost / revenue) * 100 : 0

  return {
    revenue,
    laborCost,
    profit,
    laborCostPercent,
  }
}

/**
 * Format currency in ILS (₪)
 */
export function formatCurrencyILS(amount: number): string {
  return `₪${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}




