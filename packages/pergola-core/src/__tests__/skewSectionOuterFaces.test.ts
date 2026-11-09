/**
 * Skew section builders measured from the contour at half the beam width, which
 * is right for a centerline contour and 20 mm short per side on an outer-face
 * one. A 2700 mm strip came out 2630 high instead of 2590, the rectangle value.
 */
import { describe, expect, it } from 'vitest'
import { SLANTED_WING_CONTOUR_MM } from '../acceptance/slantedWingContour'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildLamellaSections,
  specFromPlan,
} from '../index'
import type { Point2D } from '../types'

function sectionsOf(contour: Point2D[], contourReference: 'outer-faces' | 'centerline', dir: number) {
  const spec = specFromPlan({
    contour,
    wallEdgeIndices: [],
    params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: dir, contourReference },
  })
  return buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
}

const STRIP_ROW_MM = 2700

describe('skew sections on an outer-face contour', () => {
  const sections = sectionsOf(SLANTED_WING_CONTOUR_MM, 'outer-faces', 90)
  const strip = sections.filter((s) => Math.abs(s.minX - 55) < 0.5 && Math.abs(s.maxX - 2645) < 0.5)

  it('leaves a whole 40 mm beam plus the 15 mm clearance on each side of the 2700 strip', () => {
    expect(strip.length).toBeGreaterThan(10)
    for (const section of strip) expect(section.heightMm).toBeCloseTo(STRIP_ROW_MM - 2 * 55, 6)
  })

  it('matches the rectangle builder on the same 2700 width', () => {
    const rect = sectionsOf([[0, 0], [9000, 0], [9000, STRIP_ROW_MM], [0, STRIP_ROW_MM]], 'outer-faces', 0)
    expect(rect[0].heightMm).toBeCloseTo(strip[0].heightMm, 6)
  })

  it('keeps the half-width reading for a centerline contour', () => {
    const centerline = sectionsOf(SLANTED_WING_CONTOUR_MM, 'centerline', 90)
    const row = centerline.filter((s) => Math.abs(s.heightMm - 2630) < 0.5)
    expect(row.length).toBeGreaterThan(10)
  })
})
