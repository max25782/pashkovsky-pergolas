import { polygonAreaM2 } from '@pashkovsky/pergola-core'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'
import type { Pergola } from '@/types/offer'

/** Billable m²: rounded once, to two decimals, before any price multiplication. */
export function roundBillableAreaSqm(area: number): number {
  return Math.round(area * 100) / 100
}

/** Shekels for one line: rounded area × unit price, then cents. */
export function lineAmountFromBillableArea(areaSqm: number, pricePerSqm: number): number {
  return Math.round(roundBillableAreaSqm(areaSqm) * pricePerSqm * 100) / 100
}

/**
 * Billable area in m². Plan polygon wins. Legacy `shape` is used only when there is
 * no plan (old offers read from the DB), never for new quick-offer pergolas with `shape: null`.
 */
export function pergolaAreaSqm(pergola: Pergola): number | null {
  const polygon = pergola.plan?.polygon
  if (polygon && polygon.length >= 3) {
    return roundBillableAreaSqm(polygonAreaM2(polygon))
  }
  if (pergola.plan == null && pergola.shape) {
    const legacy = calculatePergolaArea(pergola.shape)
    return legacy > 0 ? roundBillableAreaSqm(legacy) : null
  }
  return null
}

/** Sum areas for totals; treats null as 0. */
export function sumPergolaAreasSqm(pergolas: Pergola[]): number {
  return pergolas.reduce((sum, pergola) => sum + (pergolaAreaSqm(pergola) ?? 0), 0)
}
