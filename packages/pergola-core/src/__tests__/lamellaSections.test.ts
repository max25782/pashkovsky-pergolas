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

  // The saved LIVE L contour was drawn for 40 mm beams (axis 6460 for a typed
  // 6500, 3460 for 3500). liveParams puts a 50 mm frame on it. AD keeps such a
  // contour as saved and cuts the cells from the drawn beam faces, so each
  // column is 2 × (50 − 40) / 2 = 10 mm taller than the typed outer. The
  // checksum test below pins that 10 mm; a contour rebuilt for 50 mm closes.
  it('LIVE L (40 mm contour, 50 mm frame): 12 cells, 6 over the beam 3380, 3 over the shelf 3385, 3 lower 2925', () => {
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params: liveParams })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(sections).toHaveLength(12)

    const heights = [...new Set(sections.map((s) => Math.round(s.heightMm)))].sort((a, b) => b - a)
    // Before AD every upper cell was 3370 and every lower cell 2920 (typed
    // outer 6500 split by a 50 mm band). Now: beam band 50 → 3380 (+10, stale
    // contour); left wing with a 40 mm shelf and no beam under it → 3385 / 2925
    // (band 40 instead of 50 gives +5 above and +5 below the shelf).
    expect(heights).toEqual([3385, 3380, 2925])

    const overBeam = sections.filter((s) => Math.abs(s.heightMm - 3380) < 0.6)
    const overShelf = sections.filter((s) => Math.abs(s.heightMm - 3385) < 0.6)
    expect(overBeam).toHaveLength(6)
    expect(overShelf).toHaveLength(3)
    for (const s of overBeam) {
      expect(s.widthMm).toBeCloseTo(1271.7, 1)
      expect(s.clearWMm).toBeCloseTo(1286.7, 1)
      expect(s.clearHMm).toBeCloseTo(3410, 1)
      expect(formatLamellaSectionSizeMm(s.widthMm, s.heightMm)).toBe('1271.7×3380')
    }
    for (const s of overShelf) expect(s.clearHMm).toBeCloseTo(3415, 1)

    const lower = sections.filter((s) => s.maxY < 3000)
    expect(lower).toHaveLength(3)
    for (const s of lower) {
      expect(s.clearHMm).toBeCloseTo(2955, 1)
      expect(s.heightMm).toBeCloseTo(2925, 1)
      expect(s.widthMm).toBeCloseTo(1271.7, 1)
    }
  })

  it('LIVE L walls on the cutout: 6 upper 3390 over the walls, 3 upper 3385 over the shelf, lower 3 × 2925', () => {
    const params = {
      ...liveParams,
      wallBeamWidthVersion: 1 as const,
      wallProfileId: 'f10040',
    }
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [1, 2], params })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(sections).toHaveLength(12)

    const upper = sections.filter((s) => s.minY > 3000)
    expect(upper).toHaveLength(9)
    // Was 9 × 3380 (a 40 mm wall on top gives 3370 + 10). Now the contour is not
    // rewritten for the 50 mm frame, so the 6 cells on the wall side are
    // 3380 + 10 = 3390, and the 3 cells over the 40 mm shelf with no beam under
    // it are 3380 + 5 = 3385 (band 40 instead of 50).
    const overWalls = upper.filter((s) => s.minX > 4000)
    const overShelf = upper.filter((s) => s.minX < 4000)
    expect(overWalls).toHaveLength(6)
    expect(overShelf).toHaveLength(3)
    for (const s of overWalls) {
      expect(s.widthMm).toBeCloseTo(1271.7, 1)
      expect(s.heightMm).toBeCloseTo(3390, 0)
      expect(s.clearHMm).toBeCloseTo(3420, 0)
      expect(s.lamellaCount).toBe(37)
    }
    for (const s of overShelf) {
      expect(s.widthMm).toBeCloseTo(1271.7, 1)
      expect(s.heightMm).toBeCloseTo(3385, 0)
      expect(s.clearHMm).toBeCloseTo(3415, 0)
      expect(s.lamellaCount).toBe(37)
    }

    const lower = sections.filter((s) => s.maxY < 3000)
    expect(lower).toHaveLength(3)
    // Was 2920. The shelf band is 40, not 50: +5 below the shelf.
    for (const s of lower) {
      expect(s.heightMm).toBeCloseTo(2925, 0)
      // Was a notch-clipped 1266.7 × 32. The span now runs to the drawn beam
      // face (axis 4000 − 25 = 3975), so all three bays are the equal 1271.7.
      expect(s.widthMm).toBeCloseTo(1271.7, 1)
      expect(s.lamellaCount).toBe(32)
    }

    const pieces = computeLamellas(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const byLen = new Map<string, number>()
    for (const p of pieces) {
      const key = (Math.round(p.lengthAxisMm * 10) / 10).toFixed(1)
      byLen.set(key, (byLen.get(key) ?? 0) + 1)
    }
    // 9 × 37 + 3 × 32 = 429, all 1271.7 (was 397 × 1271.7 + 32 × 1266.7).
    expect(pieces).toHaveLength(429)
    expect(byLen.get('1271.7')).toBe(429)
  })

  it('label equals drawn W×H within 0.5 mm', () => {
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params: liveParams })
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

  it('column checksum: a 40 mm contour under a 50 mm frame is 10 mm over the typed outer in every column', () => {
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params: liveParams })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const cols = columnHeightChecksums(sections, spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(cols.length).toBeGreaterThanOrEqual(2)
    // Right wing: 50 + 50 + (3380 + 30) = 3510 against 3500.
    // Left wing: 50 + 50 + (2925 + 30) + 40 shelf + (3385 + 30) = 6510 against 6500.
    // The 10 is (50 - 40): the contour was drawn for a 40 mm beam.
    for (const col of cols) {
      expect(col.closes).toBe(false)
      expect(col.sumMm - col.measuredOuterMm).toBeCloseTo(10, 0)
    }
    const left = cols.filter((c) => Math.abs(c.measuredOuterMm - 6500) < 1)
    const right = cols.filter((c) => Math.abs(c.measuredOuterMm - 3500) < 1)
    expect(left.length).toBeGreaterThanOrEqual(1)
    expect(right.length).toBeGreaterThanOrEqual(1)
    for (const col of left) {
      expect(col.sumMm).toBeCloseTo(6510, 0)
      expect(col.parts.find((part) => part.label === 'support')?.mm).toBeCloseTo(40, 0)
    }
    for (const col of right) expect(col.sumMm).toBeCloseTo(3510, 0)
  })

  it('column checksum: a contour rebuilt for the 50 mm frame closes on every column', () => {
    const contour = rebuildContourForEnteredOuters({
      contour: LIVE_L,
      measuredOuterLengthMmByEdgeIndex: LIVE_L_MEASURED,
      defaultBeamPlanWidthMm: 50,
    })
    expect(contour).not.toBeNull()
    expect(contour!.map((p) => p.map((v) => Math.round(v)))).toEqual([
      [0, 0], [3950, 0], [3950, 3000], [11950, 3000], [11950, 6450], [0, 6450],
    ])
    const spec = specFromPlan({ contour: contour!, wallEdgeIndices: [], params: liveParams })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const cols = columnHeightChecksums(sections, spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(cols.length).toBeGreaterThanOrEqual(2)
    for (const col of cols) {
      expect(col.closes, `${col.id} sum=${col.sumMm} outer=${col.measuredOuterMm}`).toBe(true)
    }
    // Left wing: 50 + 50 + 2955 + 40 + 3405 = 6500. Right wing: 50 + 50 + 3400 = 3500.
    expect(cols.filter((c) => Math.abs(c.sumMm - 6500) < 0.6).length).toBeGreaterThanOrEqual(1)
    expect(cols.filter((c) => Math.abs(c.sumMm - 3500) < 0.6).length).toBeGreaterThanOrEqual(1)
  })

  it('report lists clear / factory / faces for every cell', () => {
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params: liveParams })
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
      contour: LIVE_L,
      wallEdgeIndices: [],
      params: { ...liveParams, lamellaSectionLayoutVersion: undefined },
    })
    delete (legacySpec as { lamellaSectionLayoutVersion?: number }).lamellaSectionLayoutVersion
    const v1Spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params: liveParams })
    const legacy = computeLamellas(legacySpec, PERGOLA_CONSTRUCTION_PROFILES)
    const next = computeLamellas(v1Spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(legacy.length).toBe(483)
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
    // Was 397 × 1271.7 + 32 × 1256.7. The notch bay is no longer clipped to the
    // typed outer: the saved 40 mm contour is cut at the drawn 50 mm beam
    // face (4000 − 25), so all 429 lamellas are the equal 1271.7.
    expect(byLen(next)).toEqual([['1271.7', 429]])
  })
})
