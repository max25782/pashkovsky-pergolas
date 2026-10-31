import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { specFromPlan } from '../buildPieces'
import { rebuildContourForEnteredOuters } from '../planEditorOuterAxis'
import { computeLamellas } from '../lamellas'
import {
  LAMELLA_SECTION_CLEARANCE_H_MM,
  LAMELLA_SECTION_CLEARANCE_W_MM,
  buildLamellaSections,
  columnHeightChecksums,
  formatLamellaSectionSizeMm,
  reportLamellaSections,
  sectionDrawnSizeMm,
  sectionLabelMatchesDrawn,
  supportLineObstacleWidthMm,
  wingShelfPlanWidthMm,
} from '../lamellaSections'

const LIVE_L: Point2D[] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const LIVE_L_MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

const round1 = (value: number) => Math.round(value * 10) / 10

/** The contour rebuilt from the typed outers, so entered size = outer size. */
function enteredLiveL(wallEdges: number[]): Point2D[] {
  const contour = rebuildContourForEnteredOuters({
    contour: LIVE_L,
    measuredOuterLengthMmByEdgeIndex: LIVE_L_MEASURED,
    defaultBeamPlanWidthMm: 50,
    planWidthForEdge: (edgeIndex) => (wallEdges.includes(edgeIndex) ? 40 : 50),
  })
  expect(contour).not.toBeNull()
  return contour!
}

const liveParams = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'F20050',
  purlinProfileId: 'purlin-led-6040',
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  measuredOuterLengthMmByEdgeIndex: LIVE_L_MEASURED,
}

describe('lamella factory sections', () => {
  it('catalog shelf is 30 mm; subtracted support band is the 50 mm frame it sits on', () => {
    expect(wingShelfPlanWidthMm(PERGOLA_CONSTRUCTION_PROFILES, 'purlin-plain-5030')).toBe(30)
    expect(supportLineObstacleWidthMm(PERGOLA_CONSTRUCTION_PROFILES, 'F20050')).toBe(50)
    expect(LAMELLA_SECTION_CLEARANCE_W_MM).toBe(15)
    expect(LAMELLA_SECTION_CLEARANCE_H_MM).toBe(30)
  })

  // Fixtures use a contour rebuilt from the typed outers (4000 / 3000 / 8000 /
  // 3500 / 12000 / 6500) and the real beam widths, so the entered size is the
  // outer size on every side. Rule: a bay is the distance between the two
  // faces it sits between (cutter between faces), the section is that minus 30.
  //   right wing  3500 = 50 frame + 3400 clear + 50 frame          -> 3370
  //   lower left  clear 2955 (3000 axis: 25 frame face .. 20 shelf face) -> 2925
  //   upper left  6500 - 50 - 50 - 40 shelf - 2955 = 3405 clear    -> 3375
  it('LIVE L (entered = outer, 50 mm frame): 12 cells, 7 over the beam 3370, 2 over the shelf 3375, 3 lower 2925', () => {
    const spec = specFromPlan({ contour: enteredLiveL([]), wallEdgeIndices: [], params: liveParams })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(sections).toHaveLength(12)

    const heights = [...new Set(sections.map((s) => Math.round(s.heightMm)))].sort((a, b) => b - a)
    // Rule: 3375 / 3370 / 2925. The old stale-contour fixture (40 mm contour
    // under a 50 mm frame) gave 3385 / 3380 / 2925: +10 on both upper values,
    // the typed outer exceeded by 2 × (50 - 40) / 2.
    expect(heights).toEqual([3375, 3370, 2925])

    const overBeam = sections.filter((s) => Math.abs(s.heightMm - 3370) < 0.6)
    const overShelf = sections.filter((s) => Math.abs(s.heightMm - 3375) < 0.6)
    // The bay over x = 3950 sits half on the shelf (clear 3405) and half on the
    // beam (clear 3400); a lamella runs the whole bay, so it takes the smaller
    // 3400 and is counted with the beam cells: 6 + 1 = 7.
    expect(overBeam).toHaveLength(7)
    expect(overShelf).toHaveLength(2)
    for (const s of overBeam) {
      expect(s.widthMm).toBeCloseTo(1271.7, 1)
      expect(s.clearWMm).toBeCloseTo(1286.7, 1)
      expect(s.clearHMm).toBeCloseTo(3400, 1)
      expect(formatLamellaSectionSizeMm(s.widthMm, s.heightMm)).toBe('1271.7×3370')
    }
    for (const s of overShelf) expect(s.clearHMm).toBeCloseTo(3405, 1)

    const lower = sections.filter((s) => s.maxY < 3000)
    expect(lower).toHaveLength(3)
    for (const s of lower) {
      expect(s.clearHMm).toBeCloseTo(2955, 1)
      expect(s.heightMm).toBeCloseTo(2925, 1)
    }
    expect(lower.map((s) => round1(s.widthMm)).sort((x, y) => y - x)).toEqual([1271.7, 1271.7, 1231.7])
  })

  // Walls on edges 1 and 2 are 40 mm, the rest 50. Rule:
  //   right wing  3500 = 50 frame + 3410 clear + 40 wall           -> 3380
  //   upper left  6500 - 50 - 50 - 40 shelf - 2950 = 3410 clear    -> 3380
  //   lower left  clear 2950 (2995 axis: 25 frame face .. 20 shelf face) -> 2920
  it('LIVE L walls on the cutout (entered = outer): 9 upper 3380, lower 3 × 2920', () => {
    const params = {
      ...liveParams,
      wallBeamWidthVersion: 1 as const,
      wallProfileId: 'f10040',
    }
    const spec = specFromPlan({ contour: enteredLiveL([1, 2]), wallEdgeIndices: [1, 2], params })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(sections).toHaveLength(12)

    const upper = sections.filter((s) => s.minY > 3000)
    expect(upper).toHaveLength(9)
    // Old stale-contour fixture: 6 × 3390 over the walls and 3 × 3385 over the
    // shelf, lower 2925. Rule: 3380 everywhere above (clear 3410) and 2920
    // below (clear 2950): -10 over the walls, -5 over the shelf, -5 below.
    // The wall edge cut the upper bay at its centre + 15 instead of its own
    // face + 20, which was 5 mm too tall on a contour that already matches.
    for (const s of upper) {
      expect(s.widthMm).toBeCloseTo(1271.7, 1)
      expect(s.heightMm).toBeCloseTo(3380, 1)
      expect(s.clearHMm).toBeCloseTo(3410, 1)
      expect(s.lamellaCount).toBe(37)
    }

    const lower = sections.filter((s) => s.maxY < 3000)
    expect(lower).toHaveLength(3)
    for (const s of lower) {
      expect(s.heightMm).toBeCloseTo(2920, 1)
      expect(s.clearHMm).toBeCloseTo(2950, 1)
      expect(s.lamellaCount).toBe(32)
    }
    // The lower notch bay ends on the wall face (axis 3955 - 20): 1241.7 wide.
    expect(lower.map((s) => round1(s.widthMm)).sort((x, y) => y - x)).toEqual([1271.7, 1271.7, 1241.7])

    // 9 × 37 + 3 × 32 = 429: 397 at 1271.7 and 32 at 1241.7.
    const pieces = computeLamellas(spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(pieces).toHaveLength(429)
    const byLen = new Map<string, number>()
    for (const p of pieces) {
      const key = (Math.round(p.lengthAxisMm * 10) / 10).toFixed(1)
      byLen.set(key, (byLen.get(key) ?? 0) + 1)
    }
    expect([...byLen.entries()].sort((x, y) => Number(y[0]) - Number(x[0]))).toEqual([['1271.7', 397], ['1241.7', 32]])

    // Columns close on the typed outers with tolerance 0.
    // Left: 50 + 50 + 2950 + 40 + 3410 = 6500.
    // Right: 50 (top beam) + 40 (wall) + 3410 = 3500.
    const cols = columnHeightChecksums(sections, spec, PERGOLA_CONSTRUCTION_PROFILES)
    const left = cols.filter((col) => col.measuredOuterMm === 6500)
    const right = cols.filter((col) => col.measuredOuterMm === 3500)
    expect(left).toHaveLength(3)
    expect(right).toHaveLength(6)
    for (const col of left) {
      expect(col.parts.map((part) => part.mm)).toEqual([50, 50, 2950, 40, 3410])
      expect(col.sumMm).toBe(6500)
      expect(col.sumMm - col.measuredOuterMm).toBe(0)
    }
    for (const col of right) {
      expect(col.parts.map((part) => part.mm)).toEqual([40, 50, 3410])
      expect(col.sumMm).toBe(3500)
      expect(col.sumMm - col.measuredOuterMm).toBe(0)
    }
  })

  it('label equals drawn W×H within 0.5 mm', () => {
    const spec = specFromPlan({ contour: enteredLiveL([]), wallEdgeIndices: [], params: liveParams })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    for (const s of sections) {
      expect(sectionLabelMatchesDrawn(s)).toBe(true)
      const drawn = sectionDrawnSizeMm(s)
      expect(Math.abs(drawn.widthMm - s.widthMm)).toBeLessThanOrEqual(0.5)
      expect(Math.abs(drawn.heightMm - s.heightMm)).toBeLessThanOrEqual(0.5)
      const label = formatLamellaSectionSizeMm(s.widthMm, s.heightMm)
      expect(label).toBe(formatLamellaSectionSizeMm(drawn.widthMm, drawn.heightMm))
    }
  })

  it('column checksum: entered = outer closes on every column', () => {
    const contour = enteredLiveL([])
    expect(contour.map((p) => p.map((v) => Math.round(v)))).toEqual([
      [0, 0], [3950, 0], [3950, 3000], [11950, 3000], [11950, 6450], [0, 6450],
    ])
    const spec = specFromPlan({ contour, wallEdgeIndices: [], params: liveParams })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const cols = columnHeightChecksums(sections, spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(cols).toHaveLength(9)
    for (const col of cols) {
      expect(col.sumMm, `${col.id} parts=${col.parts.map((part) => part.mm).join('+')}`).toBe(col.measuredOuterMm)
      expect(col.sumMm - col.measuredOuterMm).toBe(0)
      expect(col.closes).toBe(true)
    }
    // Shelf columns: 50 + 50 + 2955 + 40 + 3405 = 6500.
    // The bay that straddles the shelf step stays one cell and takes the
    // smaller clear, so that column is 50 + 50 + 2955 + 45 + 3400 = 6500.
    // Right wing: 50 + 50 + 3400 = 3500.
    const shelf = cols.filter((col) => col.parts.some((part) => part.label === 'support' && part.mm === 40))
    const step = cols.filter((col) => col.parts.some((part) => part.label === 'support' && part.mm === 45))
    const right = cols.filter((col) => col.parts.length === 3)
    expect(shelf).toHaveLength(2)
    expect(step).toHaveLength(1)
    expect(right).toHaveLength(6)
    for (const col of shelf) {
      expect(col.parts.map((part) => part.mm)).toEqual([50, 50, 2955, 40, 3405])
      expect(col.sumMm).toBe(6500)
    }
    for (const col of step) {
      expect(col.parts.map((part) => part.mm)).toEqual([50, 50, 2955, 45, 3400])
      expect(col.sumMm).toBe(6500)
    }
    for (const col of right) {
      expect(col.parts.map((part) => part.mm)).toEqual([50, 50, 3400])
      expect(col.sumMm).toBe(3500)
    }
  })

  it('report lists clear / factory / faces for every cell', () => {
    const spec = specFromPlan({ contour: enteredLiveL([]), wallEdgeIndices: [], params: liveParams })
    const rows = reportLamellaSections(buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES))
    expect(rows).toHaveLength(12)
    for (const row of rows) {
      expect(row.widthMm).toBeCloseTo(row.clearXMm - 15, 5)
      expect(row.heightMm).toBeCloseTo(row.clearYMm - 30, 5)
      expect(row.faces).toMatch(/^x:\w+→\w+ y:\w+→\w+$/)
    }
  })

  it('unset version keeps legacy scan-line; version 1 uses section W', () => {
    const legacySpec = specFromPlan({
      contour: enteredLiveL([]),
      wallEdgeIndices: [],
      params: { ...liveParams, lamellaSectionLayoutVersion: undefined },
    })
    delete (legacySpec as { lamellaSectionLayoutVersion?: number }).lamellaSectionLayoutVersion
    const v1Spec = specFromPlan({ contour: enteredLiveL([]), wallEdgeIndices: [], params: liveParams })
    const legacy = computeLamellas(legacySpec, PERGOLA_CONSTRUCTION_PROFILES)
    const next = computeLamellas(v1Spec, PERGOLA_CONSTRUCTION_PROFILES)
    // The stale 40 mm contour gave 483: 39 × 1341.7 + 72 × 1331.7 + 339 × 1326.7
    // + 33 slivers of 15 mm at the notch end. On the rebuilt contour those 33
    // slivers are gone: 111 × 1331.7 + 306 × 1326.7 + 33 × 1291.7 = 450.
    expect(legacy.length).toBe(450)
    expect(next.length).toBeGreaterThan(0)
    const nextLengths = new Set(next.map((p) => Math.round(p.lengthAxisMm * 10) / 10))
    expect([...nextLengths].some((len) => Math.abs(len - 1271.7) < 0.2)).toBe(true)
    const byLen = (pieces: typeof next) => {
      const map = new Map<string, number>()
      for (const p of pieces) {
        const key = (Math.round(p.lengthAxisMm * 10) / 10).toFixed(1)
        map.set(key, (map.get(key) ?? 0) + 1)
      }
      return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]))
    }
    expect(legacy.length).not.toBe(next.length)
    expect(next.length).toBe(429)
    // 9 × 37 upper + 3 × 32 lower: 397 at 1271.7 and 32 in the notch bay at
    // 1231.7 (its right end is the notch beam face, 3950 + 25).
    expect(byLen(next)).toEqual([['1271.7', 397], ['1231.7', 32]])
  })
})
