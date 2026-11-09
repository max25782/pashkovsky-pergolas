import { describe, expect, it } from 'vitest'
import {
  SLANTED_WING_CONTOUR_MM,
  SLANTED_WING_INPUT,
  buildSlantedWingContour,
} from '../acceptance/slantedWingContour'

function interiorAnglesDeg(contour: ReadonlyArray<readonly [number, number]>): number[] {
  const n = contour.length
  let area2 = 0
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    area2 += a[0] * b[1] - b[0] * a[1]
  }
  const orientation = Math.sign(area2)
  return contour.map((p, i) => {
    const prev = contour[(i + n - 1) % n]
    const next = contour[(i + 1) % n]
    const d1 = [p[0] - prev[0], p[1] - prev[1]]
    const d2 = [next[0] - p[0], next[1] - p[1]]
    const turn = Math.atan2(d1[0] * d2[1] - d1[1] * d2[0], d1[0] * d2[0] + d1[1] * d2[1])
    return 180 - orientation * ((turn * 180) / Math.PI)
  })
}

describe('slanted wing contour (hand-sketched hexagon)', () => {
  const { contour, edgeLengthsMm } = buildSlantedWingContour()

  it('derives the three missing lines', () => {
    const [outerSlant, short, innerSlant, innerLong, bottomSlant, outerLong] = edgeLengthsMm
    const sin = Math.sin(((180 - SLANTED_WING_INPUT.slantAngleDeg) * Math.PI) / 180)
    const gap = SLANTED_WING_INPUT.longLineGapMm
    expect(outerSlant).toBeCloseTo(8217 + gap / sin, 6)
    expect(outerSlant).toBeCloseTo(11013.9, 0)
    expect(short).toBeCloseTo(2700, 6)
    expect(innerSlant).toBeCloseTo(8217, 6)
    expect(innerLong).toBeCloseTo(26328, 6)
    expect(bottomSlant).toBeCloseTo(gap / sin, 6)
    expect(bottomSlant).toBeCloseTo(2796.9, 0)
    expect(outerLong).toBeCloseTo(29028, 6)
  })

  it('is closed with the configured gap between the long lines', () => {
    expect(contour).toHaveLength(6)
    expect(contour[3][0] - contour[0][0]).toBeCloseTo(SLANTED_WING_INPUT.longLineGapMm, 6)
    expect(contour[4][0] - contour[5][0]).toBeCloseTo(SLANTED_WING_INPUT.longLineGapMm, 6)
    // Bottom slant joins the long lines with the same direction as the outer slant.
    const bottom = [contour[4][0] - contour[5][0], contour[4][1] - contour[5][1]]
    const outer = [contour[1][0] - contour[0][0], contour[1][1] - contour[0][1]]
    expect(bottom[0] / Math.hypot(...bottom)).toBeCloseTo(outer[0] / Math.hypot(...outer), 9)
    expect(bottom[1] / Math.hypot(...bottom)).toBeCloseTo(outer[1] / Math.hypot(...outer), 9)
  })

  it('has interior angles 74.9 / 105.1 / 74.9 / 285.1 / 74.9 / 105.1 summing to 720', () => {
    const angles = interiorAnglesDeg(SLANTED_WING_CONTOUR_MM)
    const expected = [74.9, 105.1, 74.9, 285.1, 74.9, 105.1]
    angles.forEach((a, i) => expect(a).toBeCloseTo(expected[i], 6))
    expect(angles.reduce((s, a) => s + a, 0)).toBeCloseTo(720, 6)
  })
})
