/**
 * Max house / U-notch: notch floor continues as left AND right wing shelves.
 * Previously findConcave kept only the longest (left ~3280), so the right
 * protrusion (~2750) had no shelf and the right purlin stayed a 6 m stock split.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPieces,
  buildLamellaSections,
  countedLamellaRows,
  findWingShelfSpanSegments,
  resolveAllWingShelfSupports,
  computeFrame,
  specFromPlan,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '../index'
import {
  HOUSE_CONTOUR_MM,
  HOUSE_WALL_EDGE_INDICES,
  houseConstructionParams,
} from '../acceptance/houseContour'

const profiles = PERGOLA_CONSTRUCTION_PROFILES

function houseParamsWithSevenClears() {
  const clear = 1310.7142857
  const lines = Array.from({ length: 6 }, (_, i) => {
    const k = i + 1
    return { id: `div-${k}`, positionMm: 40 + k * clear + (k - 1) * 40 + 20 }
  })
  return houseConstructionParams({
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    purlinClearLayoutVersion: 1,
    lamellaSectionLayoutVersion: 1,
    skewSectionVersion: 1,
    wallBeamWidthVersion: 1,
    wallProfileId: 'f10040',
    beamProfileId: 'f12040',
    purlinProfileId: 'PA3022',
    frameJointVersion: 1,
    wingShelfProfileId: 'f10040',
    purlinDividers: { mode: 'manual', lines },
  })
}

describe('house U-notch dual wing shelf', () => {
  it('finds left (~3280) and right (~2750) raw shelves on the notch floor', () => {
    const segs = findWingShelfSpanSegments(HOUSE_CONTOUR_MM, 0)
    expect(segs.length).toBe(2)
    const lens = segs
      .map((s) => Math.hypot(s.end[0] - s.start[0], s.end[1] - s.start[1]))
      .sort((a, b) => b - a)
    expect(lens[0]).toBeCloseTo(3280, 0)
    expect(lens[1]).toBeCloseTo(2750, 0)
  })

  it('resolves two f10040 shelves; right purlin splits like left; no 6 m mid-joint', () => {
    const params = houseParamsWithSevenClears()
    const spec = specFromPlan({
      contour: HOUSE_CONTOUR_MM,
      wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
      params,
    })
    const frame = computeFrame(spec, profiles)
    const supports = resolveAllWingShelfSupports({
      contour: HOUSE_CONTOUR_MM,
      params,
      profiles,
      beams: frame.beams,
      wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
    })
    expect(supports).toHaveLength(2)
    expect(supports.every((s) => s.profileId === 'f10040')).toBe(true)
    const lens = supports.map((s) => s.lengthMm).sort((a, b) => b - a)
    expect(lens[0]).toBeCloseTo(3240, 0)
    expect(lens[1]).toBeCloseTo(2710, 0)

    const built = buildPieces(spec, profiles)
    const shelf = built.pieces.filter((p) => p.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(shelf).toHaveLength(2)

    const purlins = built.pieces.filter(
      (p) => p.role === 'purlin' && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID,
    )
    // No full-height ~7400 / stock-halved ~3720 mid-joint on the right wing.
    for (const p of purlins) {
      expect(p.lengthAxisMm).toBeLessThan(5000)
      expect(p.lengthAxisMm < 3600 || p.lengthAxisMm > 3900).toBe(true)
    }
    const rightish = purlins.filter((p) => {
      const x = ((p.clipPlanStart?.[0] ?? p.position[0]) + (p.clipPlanEnd?.[0] ?? p.position[0])) / 2
      return x > 7000
    })
    expect(rightish.length).toBeGreaterThanOrEqual(2)
    const rightLens = rightish.map((p) => p.lengthAxisMm).sort((a, b) => a - b)
    expect(rightLens[0]).toBeGreaterThan(2700)
    expect(rightLens[0]).toBeLessThan(2900)
    expect(rightLens[rightLens.length - 1]).toBeGreaterThan(4500)
    expect(rightLens[rightLens.length - 1]).toBeLessThan(4700)

    const sections = buildLamellaSections(spec, profiles)
    const right = sections.filter((s) => (s.minX + s.maxX) / 2 > 7000)
    expect(right.length).toBeGreaterThanOrEqual(2)
    for (const s of right) {
      expect(s.maxY - s.minY).toBeGreaterThan(100)
      expect(s.maxY - s.minY).toBeLessThan(5000)
      expect(countedLamellaRows(s)).toBeGreaterThan(0)
    }
  })

  it('section cells do not overlap; centroids stay in their own row band', () => {
    const params = houseParamsWithSevenClears()
    const spec = specFromPlan({
      contour: HOUSE_CONTOUR_MM,
      wallEdgeIndices: HOUSE_WALL_EDGE_INDICES,
      params,
    })
    const sections = buildLamellaSections(spec, profiles)
    for (let i = 0; i < sections.length; i++) {
      const a = sections[i]
      expect(a.maxY - a.minY).toBeGreaterThan(100)
      const acx = (a.minX + a.maxX) / 2
      const acy = (a.minY + a.maxY) / 2
      expect(acx).toBeGreaterThanOrEqual(a.minX - 0.5)
      expect(acx).toBeLessThanOrEqual(a.maxX + 0.5)
      expect(acy).toBeGreaterThanOrEqual(a.minY - 0.5)
      expect(acy).toBeLessThanOrEqual(a.maxY + 0.5)
      for (let j = i + 1; j < sections.length; j++) {
        const b = sections[j]
        const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
        const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
        expect(overlapX <= 1 || overlapY <= 1).toBe(true)
      }
    }
  })
})
