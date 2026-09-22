import { polygonAreaM2 } from '@pashkovsky/pergola-core'
import { calculatePergolaArea } from '@/lib/calculations/pergola-area'
import type { Pergola } from '@/types/offer'

/** Area in m²: from plan polygon when present, otherwise legacy `shape`. */
export function pergolaAreaSqm(pergola: Pergola): number {
  const polygon = pergola.plan?.polygon
  if (polygon && polygon.length >= 3) {
    return polygonAreaM2(polygon)
  }
  if (pergola.shape) {
    return calculatePergolaArea(pergola.shape)
  }
  return 0
}
