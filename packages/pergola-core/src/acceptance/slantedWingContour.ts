import type { Point2D } from '../types'

/**
 * Hand-sketched hexagon (outer faces) solved from partial measurements.
 *
 * Given (inner lines, mm / deg): inner long line 26328, inner slant 8217, short edge 2700,
 * distance between the outer and inner long lines 2700, slant angle 105.1 deg.
 * All three slanted sides are parallel; both long lines and the short edge are parallel.
 *
 * Derived: outer long line 29028, outer slant ~11014, bottom slant ~2797.
 *
 * Plane coordinates follow the plan editor: x to the right, y down.
 * Vertex order is clockwise on screen, starting at the top of the outer long line.
 */
export const SLANTED_WING_INPUT = {
  innerLongMm: 26328,
  innerSlantMm: 8217,
  shortEdgeMm: 2700,
  longLineGapMm: 2700,
  slantAngleDeg: 105.1,
} as const

export interface SlantedWingContour {
  contour: Point2D[]
  /** Edge i joins vertex i to vertex i+1. Order: outer slant, short, inner slant, inner long, bottom slant, outer long. */
  edgeLengthsMm: number[]
}

export function buildSlantedWingContour(input = SLANTED_WING_INPUT): SlantedWingContour {
  // The slant makes (180 - 105.1) deg with the long lines.
  const alpha = ((180 - input.slantAngleDeg) * Math.PI) / 180
  const cos = Math.cos(alpha)
  const sin = Math.sin(alpha)

  const outerSlantMm = input.innerSlantMm + input.longLineGapMm / sin
  const bottomSlantMm = input.longLineGapMm / sin
  const outerLongMm = input.innerLongMm + input.shortEdgeMm

  // u runs along the long lines (screen y), v is perpendicular to them (screen x).
  const q: Point2D = [outerSlantMm * sin, outerSlantMm * cos]
  const r: Point2D = [q[0], q[1] + input.shortEdgeMm]
  const t: Point2D = [input.longLineGapMm, r[1] - input.innerSlantMm * cos]
  const b: Point2D = [input.longLineGapMm, t[1] + input.innerLongMm]
  const p5: Point2D = [0, outerLongMm]

  const contour: Point2D[] = [[0, 0], q, r, t, b, p5]
  const edgeLengthsMm = contour.map((a, i) => {
    const c = contour[(i + 1) % contour.length]
    return Math.hypot(c[0] - a[0], c[1] - a[1])
  })
  return { contour, edgeLengthsMm }
}

export const SLANTED_WING_CONTOUR_MM: Point2D[] = buildSlantedWingContour().contour
