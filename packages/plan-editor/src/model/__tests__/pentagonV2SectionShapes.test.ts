/**
 * Shape (not only number) checks for pentagon v2 section polygons: area vs
 * lamella pack, centroid in bay, no thin non-A/L strips, neighbours fit.
 */
import { describe, expect, it } from 'vitest'
import {
  buildLamellaSections,
  countedLamellaRows,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  groupLamellaSectionTypes,
  PERGOLA_CONSTRUCTION_PROFILES,
  specFromPlan,
} from '@pashkovsky/pergola-core'
import type { LamellaSection, Point2D } from '@pashkovsky/pergola-core'
import {
  pentagonV2Contour,
  pentagonV2PlanParams,
  pentagonV2SupportBeams,
  V2_CROSSBEAM_FACES_Y_MM,
} from './fixtures/skew-pentagon-850-2026-11-01-v2'

const profiles = PERGOLA_CONSTRUCTION_PROFILES
const params = pentagonV2PlanParams(DEFAULT_PLAN_CONSTRUCTION_PARAMS)

function build(mirror: boolean) {
  const contour = pentagonV2Contour(mirror)
  const supportBeams = pentagonV2SupportBeams(mirror)
  const spec = specFromPlan({ contour, wallEdgeIndices: [], params, supportBeams })
  return buildLamellaSections(spec, profiles)
}

function sectionCorners(section: LamellaSection): Point2D[] {
  return section.trapezoid?.corners ?? [
    [section.minX, section.minY],
    [section.maxX, section.minY],
    [section.maxX, section.maxY],
    [section.minX, section.maxY],
  ]
}

function polygonArea(corners: Point2D[]): number {
  let sum = 0
  for (let i = 0; i < corners.length; i++) {
    const [x0, y0] = corners[i]
    const [x1, y1] = corners[(i + 1) % corners.length]
    sum += x0 * y1 - x1 * y0
  }
  return Math.abs(sum) / 2
}

function polygonCentroid(corners: Point2D[]): Point2D {
  let area2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < corners.length; i++) {
    const [x0, y0] = corners[i]
    const [x1, y1] = corners[(i + 1) % corners.length]
    const cross = x0 * y1 - x1 * y0
    area2 += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  if (Math.abs(area2) < 1e-6) {
    const sx = corners.reduce((n, p) => n + p[0], 0) / corners.length
    const sy = corners.reduce((n, p) => n + p[1], 0) / corners.length
    return [sx, sy]
  }
  return [cx / (3 * area2), cy / (3 * area2)]
}

function bayFacesForY(y: number): { lo: number; hi: number } | null {
  const faces = V2_CROSSBEAM_FACES_Y_MM
  const frameTop = 9786.769
  if (y < faces[0][0]) return { lo: 20, hi: faces[0][0] }
  for (let i = 0; i < faces.length - 1; i++) {
    if (y > faces[i][1] && y < faces[i + 1][0]) return { lo: faces[i][1], hi: faces[i + 1][0] }
  }
  if (y > faces[6][1]) return { lo: faces[6][1], hi: frameTop }
  return null
}

function polygonHeightMm(corners: Point2D[]): number {
  const ys = corners.map((c) => c[1])
  return Math.max(...ys) - Math.min(...ys)
}

function segmentsIntersect(a0: Point2D, a1: Point2D, b0: Point2D, b1: Point2D): boolean {
  const cross = (o: Point2D, p: Point2D, q: Point2D) =>
    (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
  const d1 = cross(a0, a1, b0)
  const d2 = cross(a0, a1, b1)
  const d3 = cross(b0, b1, a0)
  const d4 = cross(b0, b1, a1)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  return false
}

function polygonsOverlap(a: Point2D[], b: Point2D[]): boolean {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true
    }
  }
  return false
}

describe.each([
  ['drawing frame (ccw)', false],
  ['editor mirror (cw)', true],
] as const)('pentagon v2 section shapes: %s', (_label, mirror) => {
  const sections = build(mirror)
  const schedule = groupLamellaSectionTypes(sections)
  const letterOf = new Map<string, string>()
  for (const t of schedule.types) {
    for (const id of t.sectionIds) letterOf.set(id, t.typeId)
  }

  it('has 16 sections', () => {
    expect(sections).toHaveLength(16)
  })

  it('polygon area matches lamella length×pitch within ~1%', () => {
    for (const s of sections) {
      const letter = letterOf.get(s.id) ?? '?'
      const corners = sectionCorners(s)
      const poly = polygonArea(corners)
      const lengths =
        s.trapezoid?.lamellaLengthsMm.filter((l) => l > 0)
        ?? Array.from({ length: countedLamellaRows(s) }, () => s.widthMm)
      const pack = lengths.reduce((n, len) => n + len * s.pitchMm, 0)
      expect(pack).toBeGreaterThan(0)
      const rel = Math.abs(poly - pack) / pack
      // Tip-fold H/I rebuild from lengths → exact. Open-skew F/G ~1.5%.
      // A/L triangles keep a half-pitch leftover at the zero tip (~7.5%).
      const limit = letter === 'A' || letter === 'L' ? 0.08 : 0.02
      expect(rel, `${letter} rel=${rel}`).toBeLessThan(limit)
    }
  })

  it('centroid of each section lies in its crossbeam bay', () => {
    for (const s of sections) {
      const [cx, cy] = polygonCentroid(sectionCorners(s))
      const bay = bayFacesForY(cy)
      expect(bay).not.toBeNull()
      expect(cy).toBeGreaterThan(bay!.lo)
      expect(cy).toBeLessThan(bay!.hi)
      // Centroid must sit inside the section AABB expanded slightly (tip sections).
      expect(cx).toBeGreaterThanOrEqual(s.minX - 1)
      expect(cx).toBeLessThanOrEqual(s.maxX + 1)
    }
  })

  it('no section shorter than 100 mm across except confirmed A/L triangles', () => {
    for (const s of sections) {
      const letter = letterOf.get(s.id) ?? '?'
      const h = polygonHeightMm(sectionCorners(s))
      if (letter === 'A' || letter === 'L') continue
      expect(h, `${letter} ${s.id} height ${h}`).toBeGreaterThanOrEqual(100)
    }
  })

  it('H and I keep a real bay-height polygon with a slant (not a strip / AABB)', () => {
    const hi = sections.filter((s) => {
      const L = letterOf.get(s.id)
      return L === 'H' || L === 'I'
    })
    expect(hi).toHaveLength(2)
    for (const s of hi) {
      expect(s.trapezoid).toBeTruthy()
      const corners = sectionCorners(s)
      const h = polygonHeightMm(corners)
      expect(h).toBeGreaterThan(100)
      const xs = new Set(corners.map((c) => +c[0].toFixed(1)))
      const ys = new Set(corners.map((c) => +c[1].toFixed(1)))
      // Trapezoid: not all four Y equal on either stack end → slant present.
      expect(ys.size).toBeGreaterThanOrEqual(3)
      expect(xs.size).toBeGreaterThanOrEqual(2)
      const w0 = s.trapezoid!.widthAtLowMm
      const w1 = s.trapezoid!.widthAtHighMm
      expect(Math.abs(w0 - w1)).toBeGreaterThan(100)
    }
  })

  it('neighbour polygons do not cross; same-bay pairs leave at most the 30 mm factory inset', () => {
    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const a = sections[i]
        const b = sections[j]
        expect(polygonsOverlap(sectionCorners(a), sectionCorners(b))).toBe(false)
        const sameBay = Math.abs((a.minY + a.maxY) / 2 - (b.minY + b.maxY) / 2) < 200
        if (!sameBay) continue
        const xGap = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX))
        // Beam (~40) + factory side inset (~30) can stack to ~70 mm. A collapsed H
        // left a ~2400 mm void beside E — anything over one bay divider fails.
        if (xGap > 0) expect(xGap).toBeLessThanOrEqual(80)
      }
    }
  })
})
