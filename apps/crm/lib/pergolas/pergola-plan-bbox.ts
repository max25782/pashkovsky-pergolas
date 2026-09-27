import type { Pergola, PergolaPlanPointMm } from '@/types/offer'

/** Axis-aligned bounding box of a plan polygon, in meters (for legacy DB columns). */
export function planPolygonBboxMeters(polygon: PergolaPlanPointMm[]): { width: number; length: number } {
  const xs = polygon.map((point) => point.x)
  const ys = polygon.map((point) => point.y)
  const widthMm = Math.max(...xs) - Math.min(...xs)
  const lengthMm = Math.max(...ys) - Math.min(...ys)
  return {
    width: Math.round((widthMm / 1000) * 1000) / 1000,
    length: Math.round((lengthMm / 1000) * 1000) / 1000,
  }
}

export function pergolaPlanBboxMeters(pergola: Pergola): { width: number; length: number } | null {
  const polygon = pergola.plan?.polygon
  if (!polygon || polygon.length < 3) return null
  return planPolygonBboxMeters(polygon)
}
