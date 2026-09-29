import type { PergolaPlanPointMm } from '@/types/offer'

/** Perimeter metrics for a closed polygon whose vertices are in millimetres. */
export interface PolygonPerimeterMetrics {
  totalMm: number
  longestEdgeMm: number
  /** Convenience: total perimeter in metres, rounded to 2 decimal places. */
  totalM: number
  /** Convenience: longest edge in metres, rounded to 2 decimal places. */
  longestEdgeM: number
}

/**
 * Computes the perimeter of a closed polygon (edges connect last vertex back to first).
 * All inputs and `totalMm` / `longestEdgeMm` are in millimetres.
 */
export function polygonPerimeterMm(pts: PergolaPlanPointMm[]): PolygonPerimeterMetrics {
  if (pts.length < 2) return { totalMm: 0, longestEdgeMm: 0, totalM: 0, longestEdgeM: 0 }

  let total = 0
  let longest = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    total += len
    if (len > longest) longest = len
  }

  return {
    totalMm: total,
    longestEdgeMm: longest,
    totalM: Math.round((total / 1000) * 100) / 100,
    longestEdgeM: Math.round((longest / 1000) * 100) / 100,
  }
}
