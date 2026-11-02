import { describe, expect, it } from 'vitest'
import {
  buildLamellaSections,
  buildPieces,
  countedLamellaRows,
  DEFAULT_KERF_MM,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  groupCutPiecesByBundle,
  groupLamellaSectionTypes,
  LAMELLA_TIP_MIN_LENGTH_MM,
  packProfile,
  PERGOLA_CONSTRUCTION_PROFILES,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { CutPiece, LamellaSection, Point2D } from '@pashkovsky/pergola-core'
import {
  pentagonV2Contour,
  pentagonV2PlanParams,
  pentagonV2SupportBeams,
  V2_BEAM,
  V2_BEAM_PLAN_WIDTH_MM,
  V2_CROSSBEAM_FACES_Y_MM,
  V2_MIRROR_X_MM,
} from './fixtures/skew-pentagon-850-2026-11-01-v2'

/**
 * Lamella sections of the skew pentagon with the drawing's straight beam stored
 * on the plan as `supportBeams` (Stage 2 — no harness supportLine).
 */
const profiles = PERGOLA_CONSTRUCTION_PROFILES
const params = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)

function build(mirror: boolean, withBeams = true) {
  const contour = pentagonV2Contour(mirror)
  const supportBeams = withBeams ? pentagonV2SupportBeams(mirror) : undefined
  const spec = specFromPlan({ contour, wallEdgeIndices: [], params, supportBeams })
  const sections = buildLamellaSections(spec, profiles)
  const built = buildPieces(spec, profiles)
  return { contour, spec, sections, pieces: built.pieces, supportBeams }
}

function rowOf(y: number): string {
  const faces = V2_CROSSBEAM_FACES_Y_MM
  if (y < faces[0][0]) return 'AB-L1'
  for (let i = 0; i < faces.length - 1; i++) {
    if (y > faces[i][1] && y < faces[i + 1][0]) return `L${i + 1}-L${i + 2}`
  }
  if (y > faces[6][1]) return 'L7-frame'
  return '?'
}

function beamX(mirror: boolean): number {
  return mirror ? V2_MIRROR_X_MM - V2_BEAM.axisFromEaOuterMm : V2_BEAM.axisFromEaOuterMm
}

function sideOfBeam(section: LamellaSection, mirror: boolean): 'left' | 'right' {
  const xB = beamX(mirror)
  const mid = (section.minX + section.maxX) / 2
  if (mirror) return mid > xB ? 'left' : 'right'
  return mid < xB ? 'left' : 'right'
}

function f7020SumMm(pieces: CutPiece[]): number {
  return pieces
    .filter((p) => p.role === 'lamella')
    .reduce((n, p) => n + p.lengthAxisMm, 0)
}

/** Recommended-stock bar count for one profile (same waste-first rule as the CRM order sheet). */
function barsForProfile(pieces: CutPiece[], profileId: string): number {
  const bundle = [...groupCutPiecesByBundle(pieces).values()].find((b) => b[0].profileId === profileId)
  if (!bundle) return 0
  const profile = profiles.get(profileId)
  const stocks = [...(profile?.availableStockLengthsMm ?? [])].sort((a, b) => a - b)
  let bestBars: number | null = null
  let bestWaste: number | null = null
  for (const stock of stocks) {
    try {
      const plan = packProfile(bundle, stock, DEFAULT_KERF_MM)
      if (
        bestWaste == null
        || plan.totalWasteMm < bestWaste - 1
        || (Math.abs(plan.totalWasteMm - bestWaste) <= 1 && bestBars != null && plan.totalBars < bestBars)
      ) {
        bestWaste = plan.totalWasteMm
        bestBars = plan.totalBars
      }
    } catch {
      /* piece longer than this stock */
    }
  }
  return bestBars ?? 0
}

describe('skew pentagon sections without the beam (legacy of this builder)', () => {
  it('still builds sections, but does not split the three beam rows', () => {
    const { sections } = build(false, false)
    const beamRows = sections.filter((s) => ['L5-L6', 'L6-L7', 'L7-frame'].includes(rowOf((s.minY + s.maxY) / 2)))
    const byRow = new Map<string, number>()
    for (const s of beamRows) {
      const row = rowOf((s.minY + s.maxY) / 2)
      byRow.set(row, (byRow.get(row) ?? 0) + 1)
    }
    expect([...byRow.values()].some((n) => n !== 2)).toBe(true)
  })
})

describe.each([
  ['drawing frame (counter-clockwise)', false],
  ['mirrored plan as shown in the editor (clockwise)', true],
] as const)('skew pentagon sections with supportBeams: %s', (_label, mirror) => {
  const { sections, pieces } = build(mirror)
  const xB = beamX(mirror)
  const half = V2_BEAM_PLAN_WIDTH_MM / 2

  it('splits exactly the three rows the beam crosses into left and right', () => {
    const beamRows = ['L5-L6', 'L6-L7', 'L7-frame'] as const
    for (const row of beamRows) {
      const inRow = sections.filter((s) => rowOf((s.minY + s.maxY) / 2) === row)
      expect(inRow.length).toBeGreaterThanOrEqual(2)
      const left = inRow.filter((s) => sideOfBeam(s, mirror) === 'left')
      const right = inRow.filter((s) => sideOfBeam(s, mirror) === 'right')
      expect(left.length).toBeGreaterThanOrEqual(1)
      expect(right.length).toBeGreaterThanOrEqual(1)
    }
    for (const s of sections) {
      const row = rowOf((s.minY + s.maxY) / 2)
      if (beamRows.includes(row as (typeof beamRows)[number])) continue
      const endsOnBeam =
        Math.abs(s.maxX - (xB - half)) < 2
        || Math.abs(s.minX - (xB + half)) < 2
        || Math.abs(s.minX - (xB - half)) < 2
        || Math.abs(s.maxX - (xB + half)) < 2
      expect(endsOnBeam).toBe(false)
    }
  })

  it('does not keep K/L/M tip remnants as their own lettered sections', () => {
    const schedule = groupLamellaSectionTypes(sections)
    for (const type of schedule.types) {
      const nums = type.sizeLabel.split(/[×x/]/).map((p) => Number.parseFloat(p)).filter((n) => !Number.isNaN(n))
      if (nums.length < 2) continue
      const height = nums[nums.length - 1]
      const narrow = type.sizeLabel.includes('/') ? Math.min(...nums.slice(0, -1)) : Infinity
      if (height >= 500) continue
      expect(narrow).toBeGreaterThan(60)
    }
  })

  it('section lamella count matches computeLamellas and the f7020 cut list', () => {
    const fromSections = sections.reduce((n, s) => n + countedLamellaRows(s), 0)
    const lamellas = pieces.filter((p) => p.role === 'lamella')
    expect(lamellas).toHaveLength(fromSections)
    const sumSec = sections.reduce((n, s) => {
      const lengths = s.trapezoid?.lamellaLengthsMm?.filter((l) => l > 0) ?? Array.from({ length: s.lamellaCount }, () => s.widthMm)
      return n + lengths.reduce((a, b) => a + b, 0)
    }, 0)
    const sumPieces = lamellas.reduce((n, p) => n + p.lengthAxisMm, 0)
    expect(Math.abs(sumPieces - sumSec)).toBeLessThan(1)
  })

  it('every section stays inside the contour and sections do not overlap', () => {
    const { contour } = build(mirror)
    const pointInPolygon = (p: Point2D, poly: Point2D[]) => {
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i]
        const [xj, yj] = poly[j]
        if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
      }
      return inside
    }
    for (const s of sections) {
      const cx = (s.minX + s.maxX) / 2
      const cy = (s.minY + s.maxY) / 2
      expect(pointInPolygon([cx, cy], contour)).toBe(true)
    }
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const a = sections[i]
        const b = sections[j]
        const area =
          Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)) *
          Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY))
        expect(area).toBeLessThan(1)
      }
    }
  })
})

describe('skew pentagon supportBeams: both windings match', () => {
  it('same sections, lamellas, f7020 sum, bars (385 / 16 / 392249 / 67)', () => {
    const a = build(false)
    const b = build(true)
    expect(a.sections).toHaveLength(16)
    expect(b.sections).toHaveLength(16)
    const count = (sections: LamellaSection[]) => sections.reduce((n, s) => n + countedLamellaRows(s), 0)
    expect(count(a.sections)).toBe(385)
    expect(count(b.sections)).toBe(385)
    expect(Math.round(f7020SumMm(a.pieces))).toBe(392249)
    expect(Math.round(f7020SumMm(b.pieces))).toBe(392249)
    // 67 = f7020 bars on the recommended stock (production sheet), not all profiles.
    expect(barsForProfile(a.pieces, 'f7020')).toBe(67)
    expect(barsForProfile(b.pieces, 'f7020')).toBe(67)

    const cuts = (s: LamellaSection) =>
      (s.trapezoid?.lamellaLengthsMm.filter((l) => l >= LAMELLA_TIP_MIN_LENGTH_MM)
        ?? Array.from({ length: s.lamellaCount }, () => s.widthMm))
        .map((l) => Math.round(l * 10) / 10)
        .sort((x, y) => x - y)
    const bag = (sections: LamellaSection[]) =>
      sections
        .map((s) => `${s.clearWMm.toFixed(0)}x${s.clearHMm.toFixed(0)}:${cuts(s).join(',')}`)
        .sort()
    expect(bag(b.sections)).toEqual(bag(a.sections))
  })

  it('fails the beam totals when supportBeams is omitted', () => {
    const withBeam = build(false, true)
    const without = build(false, false)
    expect(withBeam.sections).toHaveLength(16)
    expect(without.sections.length).not.toBe(16)
    expect(without.pieces.filter((p) => p.role === 'lamella').length).not.toBe(385)
  })
})

describe('skew pentagon sections: saved plans keep their result', () => {
  it('a plan without skewSectionVersion still has no sections and the old lamella layout', () => {
    const { skewSectionVersion: _version, ...legacy } = params
    const spec = specFromPlan({
      contour: pentagonV2Contour(false),
      wallEdgeIndices: [],
      params: legacy,
      supportBeams: pentagonV2SupportBeams(false),
    })
    // Without skewSectionVersion the section sheet is empty; lamellas still use continuous layout.
    expect(buildLamellaSections(spec, profiles)).toHaveLength(0)
    expect(buildPieces(spec, profiles).pieces.filter((p) => p.role === 'lamella')).toHaveLength(408)
  })
})
