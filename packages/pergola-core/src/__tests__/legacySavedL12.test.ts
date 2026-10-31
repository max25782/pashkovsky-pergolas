import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { buildPiecesFromPlan, specFromPlan } from '../buildPieces'
import { contourAxesMatchEnteredOuters } from '../planEditorOuterAxis'
import { computeLamellas } from '../lamellas'
import {
  buildLamellaSections,
  columnHeightChecksums,
  formatLamellaSectionSizeMm,
} from '../lamellaSections'
import { packProfile, DEFAULT_KERF_MM } from '../packProfile'

/**
 * Saved L12, frozen at git 96d99e33:packages/pergola-core/src/__tests__/lamellaSections.test.ts
 * (`LIVE_L`). Centerlines were drawn for a 40 mm beam. The frame drawn now is
 * F20050 (50 mm). Axes are stored and must not be rebuilt.
 *
 * `ad-contour-beam-width.test.ts` freezes the same vertices for an R242 (70 mm)
 * beam. It does not cover this 50 mm frame, the 483-lamella scan, or the PDF.
 */
const LEGACY_SAVED_L12: Point2D[] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const LEGACY_SAVED_L12_AXES = [4000, 3000, 7960, 3460, 11960, 6460]
const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

const savedParams = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'F20050',
  purlinProfileId: 'purlin-led-6040',
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  measuredOuterLengthMmByEdgeIndex: MEASURED,
}

function edgeLengths(contour: Point2D[]): number[] {
  return contour.map((start, index) => {
    const end = contour[(index + 1) % contour.length]
    return Math.hypot(end[0] - start[0], end[1] - start[1])
  })
}

function lengthHistogram(pieces: Array<{ lengthAxisMm: number }>): Array<[string, number]> {
  const map = new Map<string, number>()
  for (const piece of pieces) {
    const key = (Math.round(piece.lengthAxisMm * 10) / 10).toFixed(1)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => Number(b[0]) - Number(a[0]))
}

describe('legacy saved L12 (40 mm contour, 50 mm frame)', () => {
  it('keeps the stored axes and warns that the contour was built for another beam width', () => {
    const contour = LEGACY_SAVED_L12.map((point): Point2D => [point[0], point[1]])
    expect(contourAxesMatchEnteredOuters({
      contour,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      defaultBeamPlanWidthMm: 50,
    })).toBe('mismatch')
    const messages = JSON.parse(readFileSync(
      new URL('../../../../apps/crm/messages/en.json', import.meta.url),
      'utf8',
    )) as { planEditor: { drawing: { contourBeamWidth: string } } }
    expect(messages.planEditor.drawing.contourBeamWidth).toBe(
      'Contour was built for a different beam width.',
    )

    const built = buildPiecesFromPlan(
      { contour, wallEdgeIndices: [], params: savedParams },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(contour).toEqual(LEGACY_SAVED_L12)
    expect(edgeLengths(contour)).toEqual(LEGACY_SAVED_L12_AXES)
    expect(built.pieces.length).toBeGreaterThan(0)

    const lamellas = built.pieces.filter((piece) => piece.role === 'lamella')
    const cut = packProfile(lamellas, 6000, DEFAULT_KERF_MM)
    expect(cut.totalBars).toBeGreaterThan(0)
    expect(Number.isFinite(cut.totalWasteMm)).toBe(true)
  })

  it('keeps the pre-rebuild section numbers: heights 3385/3380/2925 and 483 legacy lamellas', () => {
    const spec = specFromPlan({ contour: LEGACY_SAVED_L12, wallEdgeIndices: [], params: savedParams })
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(sections).toHaveLength(12)
    expect(edgeLengths(spec.contour)).toEqual(LEGACY_SAVED_L12_AXES)

    const heights = [...new Set(sections.map((section) => Math.round(section.heightMm)))].sort((a, b) => b - a)
    expect(heights).toEqual([3385, 3380, 2925])

    const overBeam = sections.filter((section) => Math.abs(section.heightMm - 3380) < 0.6)
    const overShelf = sections.filter((section) => Math.abs(section.heightMm - 3385) < 0.6)
    expect(overBeam).toHaveLength(6)
    expect(overShelf).toHaveLength(3)
    for (const section of overBeam) {
      expect(section.widthMm).toBeCloseTo(1271.7, 1)
      expect(section.clearWMm).toBeCloseTo(1286.7, 1)
      expect(section.clearHMm).toBeCloseTo(3410, 1)
      expect(formatLamellaSectionSizeMm(section.widthMm, section.heightMm)).toBe('1271.7×3380')
    }
    for (const section of overShelf) expect(section.clearHMm).toBeCloseTo(3415, 1)

    const lower = sections.filter((section) => section.maxY < 3000)
    expect(lower).toHaveLength(3)
    for (const section of lower) {
      expect(section.clearHMm).toBeCloseTo(2955, 1)
      expect(section.heightMm).toBeCloseTo(2925, 1)
      expect(section.widthMm).toBeCloseTo(1271.7, 1)
    }

    const cols = columnHeightChecksums(sections, spec, PERGOLA_CONSTRUCTION_PROFILES)
    const left = cols.filter((col) => Math.abs(col.measuredOuterMm - 6500) < 1)
    const right = cols.filter((col) => Math.abs(col.measuredOuterMm - 3500) < 1)
    expect(left.length).toBeGreaterThanOrEqual(1)
    expect(right.length).toBeGreaterThanOrEqual(1)
    for (const col of left) {
      expect(col.sumMm).toBeCloseTo(6510, 0)
      expect(col.parts.find((part) => part.label === 'support')?.mm).toBeCloseTo(40, 0)
    }
    for (const col of right) expect(col.sumMm).toBeCloseTo(3510, 0)

    const legacySpec = specFromPlan({
      contour: LEGACY_SAVED_L12,
      wallEdgeIndices: [],
      params: { ...savedParams, lamellaSectionLayoutVersion: undefined },
    })
    delete (legacySpec as { lamellaSectionLayoutVersion?: number }).lamellaSectionLayoutVersion
    const legacy = computeLamellas(legacySpec, PERGOLA_CONSTRUCTION_PROFILES)
    const next = computeLamellas(spec, PERGOLA_CONSTRUCTION_PROFILES)
    expect(legacy).toHaveLength(483)
    expect(next).toHaveLength(429)
    expect(lengthHistogram(next)).toEqual([['1271.7', 429]])

    const cut = packProfile(next, 6000, DEFAULT_KERF_MM)
    expect(cut.totalBars).toBeGreaterThan(0)
    expect(Number.isFinite(cut.totalWasteMm)).toBe(true)
  })
})
