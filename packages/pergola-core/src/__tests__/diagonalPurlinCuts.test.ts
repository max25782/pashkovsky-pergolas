import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { specFromPlan } from '../buildPieces'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { computePurlins } from '../purlins'
import { longPointOffset } from '../lamellas'
import { computeFrame } from '../frame'
import { WING_SHELF_SPAN_DIVIDER_ID } from '../planEditorDimensions'
import { contourEdgeOutward, vertexAnglesForContour } from '../topPlanDimensions'
import { pieceAxis } from '../pieceAxis'

/**
 * Outers 1637.1 / 3813.6 (diagonal) / 4995.1 / 2898.9 / 8658.5 / 6129.7.
 * CCW from the short bottom. Interior 122.1° at the foot of the diagonal
 * and 237.9° at the re-entrant corner. The other four corners are 90°.
 * Headings close the outer polygon: cos α = 2026.3/3813.6.
 */
const ALPHA_DEG = Math.acos(2026.3 / 3813.6) * (180 / Math.PI)
const LENGTHS = [1637.1, 3813.6, 4995.1, 2898.9, 8658.5, 6129.7]
const ANGLES = [0, ALPHA_DEG, 0, 90, 180, 270]

function contourFrom(lengthsMm: number[], angleDeg: number[]): Point2D[] {
  let x = 0
  let y = 0
  const vertices: Point2D[] = [[x, y]]
  for (let i = 0; i < lengthsMm.length; i++) {
    const rad = (angleDeg[i] * Math.PI) / 180
    x += lengthsMm[i] * Math.cos(rad)
    y += lengthsMm[i] * Math.sin(rad)
    if (i < lengthsMm.length - 1) vertices.push([x, y])
  }
  return vertices
}

const AXIS = axisLengthsFromOuterLengthsMm({
  outerLengthsMm: LENGTHS,
  angleDeg: ANGLES,
  defaultBeamPlanWidthMm: 40,
})
const CONTOUR = contourFrom(AXIS, ANGLES)

const params = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'f10040',
  lamellaGapMm: 20,
  wingShelfProfileId: 'purlin-plain-5030',
  wallBeamWidthVersion: 1 as const,
  wallProfileId: 'f10040',
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  frameJointVersion: 1 as const,
  skewSectionVersion: 1 as const,
  purlinProfileId: 'PA3022',
  measuredOuterLengthMmByEdgeIndex: LENGTHS,
}

function round1(mm: number): number {
  return Math.round(mm * 10) / 10
}

describe('diagonal plan — purlins run boundary to boundary', () => {
  const spec = specFromPlan({ contour: CONTOUR, wallEdgeIndices: [], params })
  const purlins = computePurlins(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const bars = purlins.filter((piece) => piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
  const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const angles = vertexAnglesForContour(CONTOUR)

  it('closes with interior angles 122.1° and 237.9°', () => {
    const end = CONTOUR[CONTOUR.length - 1]
    const back = [
      end[0] + AXIS[5] * Math.cos((270 * Math.PI) / 180),
      end[1] + AXIS[5] * Math.sin((270 * Math.PI) / 180),
    ]
    expect(Math.hypot(back[0], back[1])).toBeLessThan(0.1)
    const interiors = angles.angles.map((entry) => round1(entry.interiorAngleDeg)).sort((a, b) => a - b)
    expect(interiors).toEqual([90, 90, 90, 90, 122.1, 237.9])
  })

  it('upper purlins meet the beam faces, or the shelf face where there is no beam', () => {
    const profile = PERGOLA_CONSTRUCTION_PROFILES.get('PA3022')
    const onBeam = bars.filter((piece) => Math.abs(piece.lengthAxisMm - 2818.9) < 0.2)
    const onShelf = bars.filter((piece) => Math.abs(piece.lengthAxisMm - 2823.9) < 0.2)
    expect(onBeam).toHaveLength(3)
    expect(onShelf).toHaveLength(2)
    for (const piece of onBeam) {
      expect(piece.cutMiterStartDeg).toBeLessThan(0.05)
      expect(piece.cutMiterEndDeg).toBeLessThan(0.05)
      expect(piece.lengthLongMm).toBeCloseTo(2818.9, 1)
    }
    const shelfSquare = onShelf.filter((piece) => piece.cutMiterStartDeg < 0.05 && piece.cutMiterEndDeg < 0.05)
    const intoDiagonal = onShelf.find((piece) => piece.cutMiterStartDeg > 1 || piece.cutMiterEndDeg > 1)
    expect(shelfSquare).toHaveLength(1)
    expect(shelfSquare[0].lengthLongMm).toBeCloseTo(2823.9, 1)
    expect(intoDiagonal).toBeDefined()
    const miter = Math.max(intoDiagonal!.cutMiterStartDeg, intoDiagonal!.cutMiterEndDeg)
    expect(miter).toBeCloseTo(57.92, 1)
    expect(90 - miter).toBeCloseTo(32.08, 1)
    expect(Math.min(intoDiagonal!.cutMiterStartDeg, intoDiagonal!.cutMiterEndDeg)).toBeCloseTo(0, 1)
    expect(intoDiagonal!.lengthLongMm).toBeCloseTo(
      2823.9 + longPointOffset(miter, profile?.widthMm ?? 0),
      1,
    )
    const lower = bars.filter(
      (piece) => Math.abs(piece.lengthAxisMm - 2818.9) >= 0.2 && Math.abs(piece.lengthAxisMm - 2823.9) >= 0.2,
    )
    expect(lower.map((piece) => round1(piece.lengthLongMm)).sort((a, b) => a - b)).toEqual([1176, 3195.7])
    const diagonalLower = lower.find((piece) => piece.cutMiterStartDeg > 1 || piece.cutMiterEndDeg > 1)!
    expect(diagonalLower.lengthAxisMm).toBeCloseTo(1144.1, 1)
    expect(Math.max(diagonalLower.cutMiterStartDeg, diagonalLower.cutMiterEndDeg)).toBeCloseTo(57.92, 1)
    const bottom = lower.find((piece) => piece !== diagonalLower)!
    expect(bottom.cutMiterStartDeg).toBeCloseTo(0, 1)
    expect(bottom.cutMiterEndDeg).toBeCloseTo(0, 1)
  })

  it('halves the diagonal turn on the free frame corners', () => {
    const cuts = frame.beams.map((beam) => [beam.cutMiterStartDeg, beam.cutMiterEndDeg])
    expect(frame.beams.map((beam) => round1(beam.lengthLongMm))).toEqual(LENGTHS.map(round1))
    expect(cuts[1][0]).toBeCloseTo(28.96, 1)
    expect(cuts[1][1]).toBeCloseTo(28.96, 1)
    expect(cuts[0][1]).toBeCloseTo(28.96, 1)
    expect(cuts[2][0]).toBeCloseTo(28.96, 1)
    for (const [start, end] of [cuts[0], cuts[2], cuts[3], cuts[4], cuts[5]]) {
      if (start > 40) expect(start).toBeCloseTo(45, 1)
      if (end > 40) expect(end).toBeCloseTo(45, 1)
    }
    for (const pair of [cuts[3], cuts[4], cuts[5]]) {
      expect(pair[0]).toBeCloseTo(45, 1)
      expect(pair[1]).toBeCloseTo(45, 1)
    }
  })

  it('puts the diagonal and the notch edge outside the contour', () => {
    const diagonal = contourEdgeOutward(CONTOUR, 1)
    const notch = contourEdgeOutward(CONTOUR, 2)
    expect(diagonal[1]).toBeLessThan(-0.4)
    expect(notch[1]).toBeLessThan(-0.9)
  })

  it('no purlin ends in empty space', () => {
    const bounds: Array<[Point2D, Point2D]> = []
    for (let i = 0; i < CONTOUR.length; i++) bounds.push([CONTOUR[i], CONTOUR[(i + 1) % CONTOUR.length]])
    const shelf = purlins.find((piece) => piece.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    if (shelf) {
      const axis = pieceAxis(shelf)
      bounds.push([axis.start, axis.end])
    }
    const dist = (point: Point2D, a: Point2D, b: Point2D) => {
      const abx = b[0] - a[0]
      const aby = b[1] - a[1]
      const len2 = abx * abx + aby * aby
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * abx + (point[1] - a[1]) * aby) / len2))
      return Math.hypot(point[0] - (a[0] + abx * t), point[1] - (a[1] + aby * t))
    }
    for (const piece of bars) {
      const axis = pieceAxis(piece)
      for (const point of [axis.start, axis.end]) {
        const nearest = Math.min(...bounds.map(([a, b]) => dist(point, a, b)))
        expect(nearest).toBeLessThan(180)
      }
    }
  })

  it('keeps the retired shelf square at 3583.4', () => {
    const shelf = purlins.find((piece) => piece.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(shelf?.profileId).toBe('purlin-plain-5030')
    expect(shelf?.lengthAxisMm).toBeCloseTo(3583.4, 1)
    expect(shelf?.lengthLongMm).toBeCloseTo(3583.4, 1)
    expect(shelf?.cutMiterStartDeg).toBe(0)
    expect(shelf?.cutMiterEndDeg).toBe(0)
  })
})
