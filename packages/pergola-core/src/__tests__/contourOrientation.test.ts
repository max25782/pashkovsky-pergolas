import { describe, expect, it } from 'vitest'
import { buildPieces, specFromPlan } from '../buildPieces'
import { buildLamellaSections } from '../lamellaSections'
import { measuredOutersForCcwContour } from '../dividerFrameTrim'
import { edgeValuesInCcwOrder, isCCW } from '../miter'
import { contourAxesMatchEnteredOuters, rebuildContourForEnteredOuters } from '../planEditorOuterAxis'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { pieceAxis } from '../pieceAxis'
import type { Point2D } from '../types'

/**
 * Typed outers are listed per contour edge: value i belongs to contour[i] -> contour[i + 1].
 * Core code walks a counter-clockwise copy ([...contour].reverse()) of a clockwise
 * contour. Reversing the vertices turns original edge k into reversed edge n - 2 - k,
 * so the same plan drawn in either direction must give the same frame cut list,
 * lamella sections and axis check. These tests pin that for every consumer.
 */

function reversedWithOuters(contour: Point2D[], outers: number[]): { contour: Point2D[]; outers: number[] } {
  const n = contour.length
  // Same plan drawn the other way: vertices reversed, edge k becomes edge n - 2 - k.
  return {
    contour: [...contour].reverse(),
    outers: Array.from({ length: n }, (_, i) => outers[(2 * n - 2 - i) % n]),
  }
}

function edgeMidKey(a: Point2D, b: Point2D): string {
  return `${Math.round((a[0] + b[0]) / 2)},${Math.round((a[1] + b[1]) / 2)}`
}

describe('edgeValuesInCcwOrder', () => {
  const CW: Point2D[] = [[0, 0], [0, 3960], [5960, 3960], [5960, 0]]

  it('keeps the values of a counter-clockwise contour', () => {
    const ccw: Point2D[] = [[0, 0], [5960, 0], [5960, 3960], [0, 3960]]
    expect(edgeValuesInCcwOrder(ccw, [10, 20, 30, 40])).toEqual([10, 20, 30, 40])
  })

  it('re-indexes a clockwise contour as n - 2 - i', () => {
    // reversed edge 0 is (5960,0)->(5960,3960): the original edge 2 (5960,3960)->(5960,0)
    expect(edgeValuesInCcwOrder(CW, [10, 20, 30, 40])).toEqual([30, 20, 10, 40])
  })

  it('attaches every value to the same physical edge after reversing', () => {
    const contours: Point2D[][] = [
      CW,
      [[0, 0], [0, 9786], [6269, 9124], [5877, 6884], [889, 0]],
      [[0, 0], [0, 6460], [11960, 6460], [11960, 3000], [4000, 3000], [4000, 0]],
    ]
    for (const contour of contours) {
      expect(isCCW(contour)).toBe(false)
      const n = contour.length
      const labels = Array.from({ length: n }, (_, i) => i)
      const out = edgeValuesInCcwOrder(contour, labels) as number[]
      const reversed = [...contour].reverse()
      for (let i = 0; i < n; i++) {
        const original = labels[out[i]]
        const origA = contour[original]
        const origB = contour[(original + 1) % n]
        const revA = reversed[i]
        const revB = reversed[(i + 1) % n]
        expect(edgeMidKey(revA, revB)).toBe(edgeMidKey(origA, origB))
      }
    }
  })

  it('is the same rule the divider trim uses', () => {
    expect(measuredOutersForCcwContour(CW, [10, 20, 30, 40])).toEqual([30, 20, 10, 40])
  })

  it('leaves a length mismatch alone', () => {
    expect(edgeValuesInCcwOrder(CW, [10, 20, 30])).toEqual([10, 20, 30])
    expect(edgeValuesInCcwOrder(CW, undefined)).toBeUndefined()
  })
})

// A 6000 x 4000 outer rectangle with a 40 mm beam has a 5960 x 3960 centerline and
// 90 degree corners, where the +w/2 rule is exact.
const W = 40
const CCW_RECT: Point2D[] = [[0, 0], [5960, 0], [5960, 3960], [0, 3960]]
const CCW_RECT_OUTERS = [6000, 4000, 6000, 4000]
const CW_RECT: Point2D[] = [[0, 0], [0, 3960], [5960, 3960], [5960, 0]]
const CW_RECT_OUTERS = [4000, 6000, 4000, 6000]

describe('contourAxesMatchEnteredOuters: orientation', () => {
  it('counter-clockwise rectangle matches its typed outers', () => {
    expect(
      contourAxesMatchEnteredOuters({
        contour: CCW_RECT,
        measuredOuterLengthMmByEdgeIndex: CCW_RECT_OUTERS,
        defaultBeamPlanWidthMm: W,
      }),
    ).toBe('match')
  })

  it('clockwise rectangle (same plan, mirrored) matches its typed outers', () => {
    expect(
      contourAxesMatchEnteredOuters({
        contour: CW_RECT,
        measuredOuterLengthMmByEdgeIndex: CW_RECT_OUTERS,
        defaultBeamPlanWidthMm: W,
      }),
    ).toBe('match')
  })

  it('rebuilds the same centerline from the typed outers in either direction', () => {
    const ccw = rebuildContourForEnteredOuters({
      contour: CCW_RECT,
      measuredOuterLengthMmByEdgeIndex: CCW_RECT_OUTERS,
      defaultBeamPlanWidthMm: W,
    })
    const cw = rebuildContourForEnteredOuters({
      contour: CW_RECT,
      measuredOuterLengthMmByEdgeIndex: CW_RECT_OUTERS,
      defaultBeamPlanWidthMm: W,
    })
    const sides = (c: Point2D[] | null) =>
      (c ?? []).map((p, i) => Math.round(Math.hypot(c![(i + 1) % c!.length][0] - p[0], c![(i + 1) % c!.length][1] - p[1])))
    expect(sides(ccw).sort()).toEqual([3960, 3960, 5960, 5960])
    expect(sides(cw).sort()).toEqual(sides(ccw).sort())
  })
})

// Skew pentagon (drawing skew-pentagon-850-2026-11-01), beam CENTERLINE in mm.
const PENTAGON_TYPED_OUTERS = [900, 8500, 2300, 6328, 9809]
const PENTAGON_CCW: Point2D[] = [
  [20, 20], [889.81, 20], [5877.298, 6884.61], [6269.409, 9124.567], [20, 9786.769],
]
const PENTAGON_CW: Point2D[] = PENTAGON_CCW.map(([x, y]) => [6289.409 - x, y] as Point2D)

// L-shaped roof (the saved-plan shape with a wing notch). Centerline mm.
const L_CCW: Point2D[] = [[0, 0], [11960, 0], [11960, 3460], [4000, 3460], [4000, 6460], [0, 6460]]
const L_OUTERS = [12000, 3500, 8000, 3000, 4040, 6500]

// A skew quadrilateral with typed outers on every side.
const QUAD_CCW: Point2D[] = [[0, 0], [6000, 0], [5000, 4000], [0, 4000]]
const QUAD_OUTERS = [6060, 4050, 5010, 4040]

function frameBeamCutLengths(
  contour: Point2D[],
  outers: number[],
  overrides: Record<string, unknown> = {},
): Record<string, string[]> {
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'f10040',
    wallProfileId: 'f10040',
    lamellaDirectionDeg: 90,
    measuredOuterLengthMmByEdgeIndex: outers,
    ...overrides,
  }
  const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
  const ccw = isCCW(contour) ? contour : [...contour].reverse()
  const n = ccw.length
  const byEdge: Record<string, string[]> = {}
  for (const piece of buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES).pieces.filter((p) => p.role === 'beam')) {
    // A piece belongs to the edge its axis midpoint lies on (its ends sit on corners).
    const axis = pieceAxis(piece)
    const mid: Point2D = [(axis.start[0] + axis.end[0]) / 2, (axis.start[1] + axis.end[1]) / 2]
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < n; i++) {
      const a = ccw[i]
      const b = ccw[(i + 1) % n]
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const t = Math.max(0, Math.min(1, ((mid[0] - a[0]) * dx + (mid[1] - a[1]) * dy) / (dx * dx + dy * dy)))
      const dist = Math.hypot(mid[0] - (a[0] + t * dx), mid[1] - (a[1] + t * dy))
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    const key = edgeMidKey(ccw[best], ccw[(best + 1) % n])
    ;(byEdge[key] ??= []).push(`${piece.lengthAxisMm.toFixed(3)}/${piece.lengthLongMm.toFixed(3)}/${piece.lengthShortMm.toFixed(3)}`)
  }
  for (const key of Object.keys(byEdge)) byEdge[key].sort()
  return byEdge
}

// All pentagon corners are convex, so the long (outer) cut of a frame beam can
// never be shorter than its axis length and exceeds it only by the end deltas.
describe('frame beam cut lengths: orientation (skew pentagon)', () => {
  it('counter-clockwise: long cut stays within 100 mm above the axis length', () => {
    for (const lengths of Object.values(frameBeamCutLengths(PENTAGON_CCW, PENTAGON_TYPED_OUTERS))) {
      for (const entry of lengths) {
        const [axis, long] = entry.split('/').map(Number)
        expect(long).toBeGreaterThanOrEqual(axis - 0.5)
        expect(long - axis).toBeLessThan(100)
      }
    }
  })

  it('clockwise (mirrored): long cut stays within 100 mm above the axis length', () => {
    expect(isCCW(PENTAGON_CW)).toBe(false)
    for (const lengths of Object.values(frameBeamCutLengths(PENTAGON_CW, PENTAGON_TYPED_OUTERS))) {
      for (const entry of lengths) {
        const [axis, long] = entry.split('/').map(Number)
        expect(long).toBeGreaterThanOrEqual(axis - 0.5)
        expect(long - axis).toBeLessThan(100)
      }
    }
  })

  it('the left-right mirror image (same vertex order, typed outers by edge) has the same axis total per side', () => {
    // A spliced side is cut from its start corner in walking direction, so the splice
    // point of a mirror image differs; the axis total of each side must not.
    const totals = (byEdge: Record<string, string[]>) =>
      Object.values(byEdge)
        .map((entries) => entries.reduce((sum, entry) => sum + Number(entry.split('/')[0]), 0).toFixed(1))
        .sort()
    expect(totals(frameBeamCutLengths(PENTAGON_CW, PENTAGON_TYPED_OUTERS))).toEqual(
      totals(frameBeamCutLengths(PENTAGON_CCW, PENTAGON_TYPED_OUTERS)),
    )
  })
})

describe('frame cut list is the same in both directions', () => {
  const cases: Array<{ name: string; ccw: Point2D[]; outers: number[]; overrides?: Record<string, unknown> }> = [
    { name: 'skew pentagon', ccw: PENTAGON_CCW, outers: PENTAGON_TYPED_OUTERS },
    { name: 'skew quadrilateral', ccw: QUAD_CCW, outers: QUAD_OUTERS },
    { name: 'L-shaped roof', ccw: L_CCW, outers: L_OUTERS, overrides: { purlinMaxSpanMm: undefined } },
  ]

  for (const c of cases) {
    it(`${c.name}: clockwise copy gives the per-edge pieces of the counter-clockwise plan`, () => {
      const cw = reversedWithOuters(c.ccw, c.outers)
      expect(isCCW(cw.contour)).toBe(false)
      const fromCcw = frameBeamCutLengths(c.ccw, c.outers, c.overrides)
      const fromCw = frameBeamCutLengths(cw.contour, cw.outers, c.overrides)
      expect(Object.keys(fromCcw).length).toBeGreaterThanOrEqual(c.ccw.length)
      expect(fromCw).toEqual(fromCcw)
    })
  }

  it('skew pentagon: every drawn side keeps its typed outer as the long cut', () => {
    const cw = reversedWithOuters(PENTAGON_CCW, PENTAGON_TYPED_OUTERS)
    const byEdge = frameBeamCutLengths(cw.contour, cw.outers)
    // CD (typed 2300) is one piece, not spliced into 2134 + 165.
    const cd = byEdge[edgeMidKey(PENTAGON_CCW[2], PENTAGON_CCW[3])]
    expect(cd).toHaveLength(1)
    expect(Number(cd[0].split('/')[1])).toBeCloseTo(2300, 0)
    // DE (typed 6328) and AB (typed 900) are not swapped.
    const de = byEdge[edgeMidKey(PENTAGON_CCW[3], PENTAGON_CCW[4])]
    expect(de.map((entry) => Number(entry.split('/')[1])).reduce((a, b) => a + b, 0)).toBeGreaterThan(6300)
    const ab = byEdge[edgeMidKey(PENTAGON_CCW[0], PENTAGON_CCW[1])]
    expect(Number(ab[0].split('/')[1])).toBeLessThan(1000)
  })
})

describe('lamella sections: orientation (L-shaped roof with typed outers)', () => {
  function sectionsOf(contour: Point2D[], outers: number[]) {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
      wallProfileId: 'f10040',
      lamellaDirectionDeg: 0,
      measuredOuterLengthMmByEdgeIndex: outers,
    }
    const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
    return buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
      .map((s) => [s.minX, s.minY, s.maxX, s.maxY, s.clearHMm, s.heightMm].map((v) => Math.round(v * 10) / 10).join(','))
      .sort()
  }

  it('the clockwise copy gives the sections of the counter-clockwise plan', () => {
    const cw = reversedWithOuters(L_CCW, L_OUTERS)
    const fromCcw = sectionsOf(L_CCW, L_OUTERS)
    expect(fromCcw.length).toBeGreaterThan(0)
    expect(sectionsOf(cw.contour, cw.outers)).toEqual(fromCcw)
  })
})
