import { describe, expect, it } from 'vitest'
import {
  buildPiecesFromPlan,
  computeFrame,
  isOrthogonalContour,
  polygonAreaM2,
  PERGOLA_CONSTRUCTION_PROFILES,
} from '../index'
import { DEFAULT_RIGHT_ANGLE_SNAP_DEG } from '../miter'
import { buildFrameEdgeParts, piecesWeightKg } from '../frameParts'
import {
  CLOSURE_GAP_TOLERANCE_MM,
  HOUSE_CONTOUR_MM,
  HOUSE_FREE_EDGE_INDICES,
  HOUSE_RAL_1013_HEX,
  HOUSE_REFERENCE_AREA_M2,
  HOUSE_WALL_EDGE_INDICES,
  contourClosureGapMm,
  houseContourWithGhCm,
  houseSpec,
  houseSpecInput,
} from '../acceptance/houseContour'

const PROFILES = PERGOLA_CONSTRUCTION_PROFILES
const BEAM_WIDTH_MM = PROFILES.get('f10040')!.widthMm
const MAX_SPAN_MM = PROFILES.get('f10040')!.maxSpanMm!

function near(a: Point2DLike, b: readonly [number, number], eps = 1.5): boolean {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= eps
}

type Point2DLike = readonly [number, number]

describe('acceptance house contour — BOM stage A + 3D 14b', () => {
  it('builds a spec from the taped vertices with no closure warning (1 cm)', () => {
    const gap = contourClosureGapMm(HOUSE_CONTOUR_MM)
    expect(gap).toBeLessThanOrEqual(CLOSURE_GAP_TOLERANCE_MM)
    const spec = houseSpec()
    expect(spec.contour).toHaveLength(8)
    expect(spec.wallEdgeIndices).toEqual(HOUSE_WALL_EDGE_INDICES)
    expect(spec.colorHex).toBe(HOUSE_RAL_1013_HEX)
    expect(spec.supportType).toBe('wall-mounted')
    expect(() => buildPiecesFromPlan(houseSpecInput(), PROFILES)).not.toThrow()
  })

  it('E-F 0.6 cm drop is inside the 1° square-corner snap and the orthogonality flag', () => {
    const tiltDeg = Math.atan2(6, 3465) * (180 / Math.PI)
    expect(tiltDeg).toBeLessThan(DEFAULT_RIGHT_ANGLE_SNAP_DEG)
    expect(isOrthogonalContour(HOUSE_CONTOUR_MM)).toBe(true)
    const area = polygonAreaM2(HOUSE_CONTOUR_MM.map(([x, y]) => ({ x, y })))
    expect(area).toBeGreaterThan(HOUSE_REFERENCE_AREA_M2 - 2)
    expect(area).toBeLessThan(HOUSE_REFERENCE_AREA_M2 + 3)
  })

  it('BOM: one frame member per edge, 45° on every corner, long/short from miter', () => {
    const parts = buildFrameEdgeParts(HOUSE_CONTOUR_MM, BEAM_WIDTH_MM, {
      wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
      profileId: 'f10040',
    })
    expect(parts).toHaveLength(8)
    for (const part of parts) {
      expect(part.miterStartDeg).toBeCloseTo(45, 5)
      expect(part.miterEndDeg).toBeCloseTo(45, 5)
      expect(part.longMm).toBeCloseTo(part.axisMm + BEAM_WIDTH_MM, 4)
      expect(part.shortMm).toBeCloseTo(part.axisMm - BEAM_WIDTH_MM, 4)
    }
    expect(parts[0].edgeLabel).toBe('A-B')
    expect(parts[0].axisMm).toBeCloseTo(9495, 3)
    expect(parts[6].edgeLabel).toBe('G-H')
    expect(parts[6].axisMm).toBeCloseTo(3280, 3)
    expect(parts.filter((p) => p.isWall).map((p) => p.edgeLabel)).toEqual(['C-D', 'D-E', 'E-F', 'F-G'])
  })

  it('3D: no posts on wall edges C-D…F-G; free edges get max-span posts, symmetric', () => {
    const spec = houseSpec()
    const frame = computeFrame(spec, PROFILES)
    expect(frame.posts.length).toBeGreaterThan(0)

    const wallPts: Point2DLike[] = [2, 3, 4, 5, 6].map((i) => HOUSE_CONTOUR_MM[i])
    for (const post of frame.posts) {
      const plan: Point2DLike = [post.position[0], post.position[2]]
      for (const wall of wallPts) {
        expect(near(plan, wall, 25)).toBe(false)
      }
    }

    const plans = frame.posts.map((p) => [p.position[0], p.position[2]] as Point2DLike)
    const onAb = plans.filter((p) => Math.abs(p[1]) <= 25)
    const onBc = plans.filter((p) => Math.abs(p[0] - 9495) <= 25)
    const onHa = plans.filter((p) => Math.abs(p[0]) <= 25)
    const onGh = plans.filter((p) => Math.abs(p[1] - 7480) <= 25 && p[0] <= 3280 + 25)
    expect(onAb.some((p) => near(p, [0, 0], 25))).toBe(true)
    expect(onAb.some((p) => near(p, [9495, 0], 25))).toBe(true)
    expect(onBc.some((p) => near(p, [9495, 0], 25))).toBe(true)
    expect(onHa.some((p) => near(p, [0, 0], 25))).toBe(true)
    expect(onGh.some((p) => near(p, [0, 7480], 25))).toBe(true)

    for (const xs of [onAb.map((p) => p[0]).sort((a, b) => a - b)]) {
      if (xs.length < 3) continue
      const gaps = xs.slice(1).map((x, i) => x - xs[i])
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(50)
    }
    expect(HOUSE_CONTOUR_MM[6][0] - HOUSE_CONTOUR_MM[7][0]).toBeLessThan(MAX_SPAN_MM)

    const corners: Point2DLike[] = [[0, 0], [9495, 0], [0, 7480]]
    for (const c of corners) {
      expect(frame.posts.some((p) => near([p.position[0], p.position[2]], c))).toBe(true)
    }
    expect(HOUSE_FREE_EDGE_INDICES).toEqual([0, 1, 6, 7])
  })

  it('G-H 328→340 cm: spec, frame BOM and 3D rebuild with no closure error', () => {
    const stretched = houseContourWithGhCm(340)
    expect(contourClosureGapMm(stretched)).toBeLessThanOrEqual(CLOSURE_GAP_TOLERANCE_MM)
    expect(Math.hypot(stretched[6][0] - stretched[7][0], stretched[6][1] - stretched[7][1])).toBeCloseTo(3400, 5)

    const spec = houseSpec(stretched)
    expect(() => buildPiecesFromPlan(houseSpecInput(stretched), PROFILES)).not.toThrow()
    const parts = buildFrameEdgeParts(stretched, BEAM_WIDTH_MM, {
      wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
    })
    expect(parts[6].axisMm).toBeCloseTo(3400, 4)
    const frame = computeFrame(spec, PROFILES)
    expect(frame.posts.every((p) => Number.isFinite(p.lengthAxisMm))).toBe(true)
  })
})

describe('acceptance house — weight', () => {
  it('sums catalog kg/m × long length for every piece that has a supplier weight', () => {
    const built = buildPiecesFromPlan(houseSpecInput(), PROFILES)
    const kg = piecesWeightKg(built.pieces, PROFILES)
    expect(kg).toBeGreaterThan(50)
    expect(kg).toBeLessThan(800)
  })
})
