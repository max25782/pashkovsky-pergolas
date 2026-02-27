/**
 * Helper functions for Workers and Work Shifts calculations
 */

import type { WorkShift, WorkShiftGroupedByDate, ProjectProfit } from '@/types/workers'

/**
 * Parse HH:mm to minutes since midnight
 */
function timeToMinutes(timeStr: string | null): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null
  const [h, m] = timeStr.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/**
 * Compute minutes worked from start/end time
 */
export function computeMinutesWorked(startTime: string | null, endTime: string | null): number | null {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (start === null || end === null) return null
  if (end < start) return null // overnight not supported
  return end - start
}

/**
 * Compute cost for a worker shift
 * If hourly_rate: cost = hourly_rate * (minutes / 60)
 * Else: cost = full daily_rate (no proration by hours)
 */
export function computeShiftCost(
  minutesWorked: number,
  dailyRate: number,
  hourlyRate?: number | null
): number {
  if (hourlyRate != null && hourlyRate > 0) {
    return (hourlyRate * minutesWorked) / 60
  }
  return dailyRate
}

/**
 * Calculate total labor cost from work shifts
 */
export function calcLaborCost(shifts: WorkShift[]): number {
  return shifts.reduce((total, shift) => total + shift.dailyRateSnapshot, 0)
}

/**
 * Calculate profit from revenue, material cost, and labor cost
 */
export function calcProfit(revenue: number, laborCost: number, materialCost: number = 0): number {
  return revenue - laborCost - materialCost
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
export function calculateProjectProfit(revenue: number, shifts: WorkShift[], materialCost: number = 0): ProjectProfit {
  const laborCost = calcLaborCost(shifts)
  const profit = calcProfit(revenue, laborCost, materialCost)
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






