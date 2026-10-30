import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { buildPieces, specFromPlan } from '../buildPieces'
import { longPointOffset } from '../lamellas'
import { pieceAxis } from '../pieceAxis'
import { computeEqualPurlinClearMm, resolveContourPurlinPositions } from '../lamellaSpans'
import { buildLamellaSections } from '../lamellaSections'
import { outerVertexAtContourIndex } from '../topPlanDimensions'

/**
 * Live editor contour. Outers 4582.3 / 3203.7 / 9099.0 / 7408.9 / 2868.9 / 4868.6.
 * Interiors 241.5° / 77.8° / 102.2° / 90° / 90° / 118.5°.
 * The diagonal is edge 5. Equal clear is the top side, 7×1254.1.
 * The purlin at x ≈ -1280 meets the diagonal. The next one ends on the notch beam.
 */
const CONTOUR: Point2D[] = [
  [0, 0],
  [4569.400649472891, 0],
  [3900.9553840361427, 3091.320359563252],
  [-5161.95641942771, 3091.320359563253],
  [-5161.956419427711, -4277.608480798192],
  [-2324.9246987951806, -4277.608480798192],
]

const params = {
  lamellaPatternId: 'all-70',
  lamellaGapMm: 20,
  lamellaDirectionDeg: 0,
  lamellaOnEdge: false,
  visturMode: false,
  beamProfileId: 'f10040',
  purlinProfileId: 'PA3022',
  postProfileId: 'f8080',
  heightMm: 2600,
  lamellaAngleDeg: 0,
  colorHex: '#9aa0a6',
  supportType: 'free-standing' as const,
  slope: { mode: 'deg' as const, value: 0 },
  highEdgeIndex: 0,
  postHeightOverridesMm: {},
  lamellaWallThicknessMm: 0.8,
  purlinDividers: { mode: 'auto' as const },
  postMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  purlinMaxSpanMm: 4000,
  wallBeamWidthVersion: 1 as const,
  wallProfileId: 'f10040',
  frameJointVersion: 1 as const,
  skewSectionVersion: 1 as const,
  lamellaLengthStepMm: 1,
  wingShelfProfileId: 'PA1296',
}

function distToSeg(point: Point2D, a: Point2D, b: Point2D): number {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const len2 = abx * abx + aby * aby
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * abx + (point[1] - a[1]) * aby) / len2))
  return Math.hypot(point[0] - (a[0] + abx * t), point[1] - (a[1] + aby * t))
}

describe('live skew notch — purlins reach the frame or the diagonal', () => {
  const spec = specFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params })
  const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const bars = built.pieces.filter((piece) => piece.role === 'purlin' && piece.dividerId !== 'wing-shelf-span')

  it('keeps both halves of the left lines and the diagonal hit', () => {
    const byDivider = new Map<string, typeof bars>()
    for (const piece of bars) {
      const list = byDivider.get(piece.dividerId ?? '') ?? []
      list.push(piece)
      byDivider.set(piece.dividerId ?? '', list)
    }
    expect([...byDivider.keys()].sort()).toEqual(['div-1', 'div-2', 'div-3', 'div-4', 'div-5', 'div-6'])
    for (const id of ['div-1', 'div-2']) {
      const lengths = (byDivider.get(id) ?? []).map((piece) => piece.lengthAxisMm).sort((a, b) => a - b)
      expect(lengths).toHaveLength(2)
      expect(lengths[0]).toBeCloseTo(3051.3, 0)
      expect(lengths[1]).toBeCloseTo(4237.6, 0)
      for (const piece of byDivider.get(id) ?? []) {
        expect(piece.cutMiterStartDeg).toBeCloseTo(0, 1)
        expect(piece.cutMiterEndDeg).toBeCloseTo(0, 1)
      }
    }
    for (const id of ['div-4', 'div-5', 'div-6']) {
      const pieces = byDivider.get(id) ?? []
      expect(pieces).toHaveLength(1)
      expect(pieces[0].lengthAxisMm).toBeCloseTo(3051.3, 0)
    }
    const diagonal = (byDivider.get('div-3') ?? []).find((piece) => piece.cutMiterStartDeg > 1 || piece.cutMiterEndDeg > 1)
    const upper = (byDivider.get('div-3') ?? []).find((piece) => piece !== diagonal)
    expect(upper?.lengthAxisMm).toBeCloseTo(3051.3, 0)
    expect(upper?.cutMiterStartDeg).toBeCloseTo(0, 1)
    expect(upper?.cutMiterEndDeg).toBeCloseTo(0, 1)
    expect(diagonal).toBeDefined()
    const miter = Math.max(diagonal!.cutMiterStartDeg, diagonal!.cutMiterEndDeg)
    expect(miter).toBeCloseTo(61.48, 1)
    expect(90 - miter).toBeCloseTo(28.52, 1)
    expect(Math.min(diagonal!.cutMiterStartDeg, diagonal!.cutMiterEndDeg)).toBeCloseTo(0, 1)
    const width = PERGOLA_CONSTRUCTION_PROFILES.get('PA3022')?.widthMm ?? 0
    expect(diagonal!.lengthLongMm).toBeCloseTo(diagonal!.lengthAxisMm + longPointOffset(miter, width), 1)
    expect(diagonal!.lengthAxisMm).toBeCloseTo(2292.3, 0)
    expect(diagonal!.lengthLongMm - diagonal!.lengthAxisMm).toBeCloseTo(36.8, 1)
    const notchBeam = byDivider.get('div-4') ?? []
    expect(notchBeam).toHaveLength(1)
    expect(notchBeam[0].cutMiterStartDeg).toBeCloseTo(0, 1)
    expect(notchBeam[0].cutMiterEndDeg).toBeCloseTo(0, 1)
    const notchAxis = pieceAxis(notchBeam[0])
    expect(Math.min(notchAxis.start[1], notchAxis.end[1])).toBeGreaterThan(-1)
    const shelf = built.pieces.find((piece) => piece.dividerId === 'wing-shelf-span')
    expect(shelf?.profileId).toBe('PA1296')
    expect(shelf?.lengthAxisMm).toBeCloseTo(5119.2, 0)
    const shelfMiter = Math.max(shelf?.cutMiterStartDeg ?? 0, shelf?.cutMiterEndDeg ?? 0)
    expect(shelfMiter).toBeCloseTo(28.52, 1)
    expect(Math.min(shelf?.cutMiterStartDeg ?? 0, shelf?.cutMiterEndDeg ?? 0)).toBeCloseTo(0, 1)
    const shelfWidth = PERGOLA_CONSTRUCTION_PROFILES.get('PA1296')?.widthMm ?? 0
    expect(shelf?.lengthLongMm).toBeCloseTo((shelf?.lengthAxisMm ?? 0) + longPointOffset(shelfMiter, shelfWidth), 1)
    expect(PERGOLA_CONSTRUCTION_PROFILES.get('PA1296')?.weightKgPerMeter).toBeCloseTo(1.098, 3)
  })

  it('places every purlin on the top-side clear and keeps the last upper cell a trapezoid', () => {
    const half = 20
    const topLeft = outerVertexAtContourIndex(CONTOUR, 3, half, half)
    const notchCorner = outerVertexAtContourIndex(CONTOUR, 0, half, half)
    const positions = resolveContourPurlinPositions({
      contour: CONTOUR,
      lamellaDirectionDeg: 0,
      maxSpanMm: 1500,
      mode: 'auto',
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: 'f10040',
      wallProfileId: 'f10040',
      wallEdgeIndices: [],
      wallBeamWidthVersion: 1,
      layoutVersion: 1,
    })
    const clear = computeEqualPurlinClearMm({
      outerLengthMm: 9099,
      leftEndWidthMm: 40,
      rightEndWidthMm: 40,
      dividerCount: 6,
    })
    expect(clear).toBeCloseTo(1254.1, 1)
    expect(positions.map((line) => line.positionMm - topLeft[0])).toEqual([
      1314.15, 2608.3, 3902.45, 5196.6, 6490.75, 7784.9,
    ].map((station) => expect.closeTo(station, 0)))
    const fourthFromLeft = positions[3].positionMm - topLeft[0]
    const notchFromLeft = notchCorner[0] - topLeft[0]
    expect(fourthFromLeft - notchFromLeft).toBeGreaterThan(0)
    expect(fourthFromLeft - notchFromLeft).toBeLessThan(6)
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const upper = sections.filter((section) => section.minY > 0)
    const last = upper[upper.length - 1]
    expect(last.trapezoid).toBeDefined()
    expect(last.trapezoid!.widthAtHighMm).toBeLessThan(last.trapezoid!.widthAtLowMm)
    expect(upper.filter((section) => section.trapezoid == null)).toHaveLength(6)
    expect(built.warnings.length).toBeGreaterThan(0)
    expect(Math.max(...built.warnings.map((warning) => warning.spanMm ?? 0))).toBeGreaterThan(1800)
    expect(Math.max(...built.warnings.map((warning) => warning.spanMm ?? 0))).toBeLessThan(2000)
  })

  it('has no purlin end in empty space', () => {
    const edges: Array<[Point2D, Point2D]> = CONTOUR.map((point, index) => [point, CONTOUR[(index + 1) % CONTOUR.length]])
    const axes = bars.map((piece) => pieceAxis(piece))
    for (let index = 0; index < bars.length; index++) {
      for (const point of [axes[index].start, axes[index].end]) {
        const onFrame = edges.some(([a, b]) => distToSeg(point, a, b) <= 180)
        const onShelfMate = axes.some((axis, other) => other !== index && (
          Math.hypot(point[0] - axis.start[0], point[1] - axis.start[1]) <= 80
          || Math.hypot(point[0] - axis.end[0], point[1] - axis.end[1]) <= 80
        ))
        expect(onFrame || onShelfMate).toBe(true)
      }
    }
  })
})
