import { sanitizeContour } from './contourSanitize'
import { signedArea } from './miter'
import type { Point2D } from './types'
import type { PlanPointMm } from './simplePolygon'

function toContour(polygon: PlanPointMm[]): Point2D[] {
  return polygon.map((p) => [p.x, p.y])
}

/**
 * Shoelace area after `sanitizeContour`, mm² → m². No rounding — format only at display time.
 */
export function polygonAreaM2(polygon: PlanPointMm[]): number {
  if (!Array.isArray(polygon) || polygon.length < 3) return 0
  const contour = sanitizeContour(toContour(polygon))
  if (contour.length < 3) return 0
  const areaMm2 = Math.abs(signedArea(contour))
  return areaMm2 / 1_000_000
}
