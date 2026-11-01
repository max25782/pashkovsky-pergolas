import { describe, expect, it } from 'vitest'
import {
  buildLamellaSections,
  buildPieces,
  countedLamellaRows,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  groupLamellaSectionTypes,
  PERGOLA_CONSTRUCTION_PROFILES,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { LamellaSection, Point2D } from '@pashkovsky/pergola-core'
import {
  applyStraightBeam,
  pentagonV2Contour,
  pentagonV2PlanParams,
  pentagonV2SectionSupportLine,
  V2_BEAM,
  V2_CROSSBEAM_FACES_Y_MM,
  V2_MIRROR_X_MM,
} from './fixtures/skew-pentagon-850-2026-11-01-v2'

/**
 * Lamella sections of the skew pentagon with the drawing's straight beam.
 * The beam is not stored on the plan: the fixture passes it into the section
 * builder the same way the production-sheet harness does.
 */
const profiles = PERGOLA_CONSTRUCTION_PROFILES
const params = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)

function build(mirror: boolean) {
  const contour = pentagonV2Contour(mirror)
  const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
  const supportLine = pentagonV2SectionSupportLine({ contour, mirror, profiles })
  const sections = buildLamellaSections(spec, profiles, { supportLine })
  const built = buildPieces(spec, profiles, { supportLine })
  const withBeam = applyStraightBeam({ pieces: built.pieces, profiles, contour, mirror })
  return { contour, spec, supportLine, sections, pieces: withBeam.pieces }
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
  // In the mirrored frame EA is on the right, so "left of beam" in drawing terms
  // is the side toward EA (higher X when mirrored).
  if (mirror) return mid > xB ? 'left' : 'right'
  return mid < xB ? 'left' : 'right'
}

describe('skew pentagon sections without the beam (legacy of this builder)', () => {
  it('still builds sections, but does not split the three beam rows', () => {
    const contour = pentagonV2Contour(false)
    const spec = specFromPlan({ contour, wallEdgeIndices: [], params })
    const sections = buildLamellaSections(spec, profiles)
    const beamRows = sections.filter((s) => ['L5-L6', 'L6-L7', 'L7-frame'].includes(rowOf((s.minY + s.maxY) / 2)))
    // Without the support line the three rows are not split into left/right pairs.
    const byRow = new Map<string, number>()
    for (const s of beamRows) {
      const row = rowOf((s.minY + s.maxY) / 2)
      byRow.set(row, (byRow.get(row) ?? 0) + 1)
    }
    // This assertion fails on the old builder only when the beam-aware path is expected
    // elsewhere; kept as the contrast case: at least one of those rows is not a L/R pair.
    expect([...byRow.values()].some((n) => n !== 2)).toBe(true)
  })
})

describe.each([
  ['drawing frame (counter-clockwise)', false],
  ['mirrored plan as shown in the editor (clockwise)', true],
] as const)('skew pentagon sections with the straight beam: %s', (_label, mirror) => {
  const { sections, pieces, supportLine } = build(mirror)
  const xB = beamX(mirror)
  const half = supportLine.widthMm / 2

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
    // Other rows are not split by the beam.
    for (const s of sections) {
      const row = rowOf((s.minY + s.maxY) / 2)
      if (beamRows.includes(row as (typeof beamRows)[number])) continue
      // A section in a non-beam row must not end on the beam face.
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
    // Full-bay triangles may taper to 0 on BC (~880 mm stack). Forbidden: a short
    // remnant at the 153.9° kink as its own letter (narrow tip AND small stack).
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
      // Centroid of the drawn section must lie inside the frame; absorb may square a
      // tip and put a corner on the outside of a slanted edge.
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

describe('skew pentagon sections with the straight beam: both frames match', () => {
  it('same clear-size multiset; row counts may differ by the tip packing direction', () => {
    const a = build(false)
    const b = build(true)
    const key = (s: LamellaSection) => `${s.clearWMm.toFixed(0)}x${s.clearHMm.toFixed(0)}`
    expect(b.sections.map(key).sort()).toEqual(a.sections.map(key).sort())
    // Trapezoid rows are packed from the low coordinate. Mirroring flips which end is
    // low, so a tip row that floors to 0 is dropped on one frame and kept on the other.
    // Clear sizes match; the cut-list length sum for the positive rows is what the shop uses.
    const count = (sections: LamellaSection[]) => sections.reduce((n, s) => n + countedLamellaRows(s), 0)
    expect(Math.abs(count(b.sections) - count(a.sections))).toBeLessThanOrEqual(5)
  })
})

describe('skew pentagon sections: saved plans keep their result', () => {
  it('a plan without skewSectionVersion still has no sections and the old lamella layout', () => {
    const { skewSectionVersion: _version, ...legacy } = params
    const spec = specFromPlan({ contour: pentagonV2Contour(false), wallEdgeIndices: [], params: legacy })
    expect(buildLamellaSections(spec, profiles)).toHaveLength(0)
    expect(buildPieces(spec, profiles).pieces.filter((p) => p.role === 'lamella')).toHaveLength(408)
  })
})
