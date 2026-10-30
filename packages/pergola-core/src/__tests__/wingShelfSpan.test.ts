import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import {
  findConcaveLamellaParallelShelfRaw,
  wingShelfRawAtConcaveVertex,
} from '../wingShelfSpan'
import {
  buildPlanEditorOverlayModel,
  findWingShelfSpanSegment,
  resolveWingShelfSupport,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '../planEditorDimensions'
import { computeWingShelfClearSpan } from '../dividerFrameTrim'
import { computeFrame } from '../frame'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { buildPieces, specFromPlan } from '../buildPieces'
import { pieceAxis } from '../pieceAxis'

/** Axis L matching Max proportions (9000×7000 outer class): notch at bottom-right of upper wing. */
const MAX_L_AXIS: Point2D[] = [
  [0, 0],
  [9000, 0],
  [9000, 3500],
  [4500, 3500],
  [4500, 7000],
  [0, 7000],
]

const CANONICAL_L: Point2D[] = [
  [0, 0],
  [6000, 0],
  [6000, 3000],
  [3000, 3000],
  [3000, 6000],
  [0, 6000],
]

function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses =
      yi !== yj &&
      ((point[1] >= yi && point[1] < yj) || (point[1] >= yj && point[1] < yi)) &&
      point[0] < xi + ((point[1] - yi) / (yj - yi)) * (xj - xi)
    if (crosses) inside = !inside
  }
  return inside
}

describe('wingShelfSpan — L concave vertex', () => {
  const lamellaDeg = 0

  it('Max L: chooses incoming horizontal edge at notch (parallel to lamellas), not vertical leg', () => {
    const atNotch = wingShelfRawAtConcaveVertex(MAX_L_AXIS, 3, lamellaDeg)
    expect(atNotch).not.toBeNull()
    expect(atNotch!.choice.usedIncomingEdge).toBe(true)
    expect(atNotch!.choice.interiorAngleDeg).toBeGreaterThan(180)
    expect(atNotch!.start[1]).toBeCloseTo(3500, 0)
    expect(atNotch!.end[1]).toBeCloseTo(3500, 0)
    expect(Math.min(atNotch!.start[0], atNotch!.end[0])).toBeCloseTo(0, 0)
    expect(Math.max(atNotch!.start[0], atNotch!.end[0])).toBeCloseTo(4500, 0)
  })

  it('Max L: one shelf segment inside contour — no extension along bottom beam to xmax', () => {
    const shelf = findWingShelfSpanSegment(MAX_L_AXIS, lamellaDeg)
    expect(shelf).not.toBeNull()
    expect(shelf!.start[1]).toBeCloseTo(shelf!.end[1], 0)
    expect(shelf!.start[1]).toBeCloseTo(3500, 0)
    expect(Math.max(shelf!.start[0], shelf!.end[0])).toBeLessThanOrEqual(4500 + 1)
    expect(Math.min(shelf!.start[0], shelf!.end[0])).toBeGreaterThanOrEqual(-1)

    const mid: Point2D = [
      (shelf!.start[0] + shelf!.end[0]) / 2,
      (shelf!.start[1] + shelf!.end[1]) / 2,
    ]
    expect(pointInPolygon(mid, MAX_L_AXIS)).toBe(true)

    const xmax = Math.max(...MAX_L_AXIS.map((p) => p[0]))
    expect(Math.max(shelf!.start[0], shelf!.end[0])).toBeLessThan(xmax)
  })

  it('Max L: clear span length = inner faces left beam ↔ notch vertical beam', () => {
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: lamellaDeg }
    const profiles = PERGOLA_CONSTRUCTION_PROFILES
    const spec = specFromPlan({ contour: MAX_L_AXIS, wallEdgeIndices: [], params })
    const frame = computeFrame(spec, profiles)
    const shelf = findConcaveLamellaParallelShelfRaw(MAX_L_AXIS, lamellaDeg)
    expect(shelf).not.toBeNull()
    const clear = computeWingShelfClearSpan(shelf!, frame.beams, profiles)
    expect(clear.start[1]).toBeCloseTo(clear.end[1], 0)
    expect(clear.end[0]).toBeLessThanOrEqual(4500)
    expect(clear.lengthMm).toBeCloseTo(4460, 0)
  })

  it('Max L overlay: single wing-shelf divider line at notch shelf Y', () => {
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: lamellaDeg }
    const model = buildPlanEditorOverlayModel({
      contour: MAX_L_AXIS,
      wallEdgeIndices: [],
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    const wingLines = model!.dividerLines.filter((l) => l.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(wingLines).toHaveLength(1)
    const wing = wingLines[0]
    expect(wing.start[1]).toBeCloseTo(wing.end[1], 0)
    expect(wing.start[1]).toBeCloseTo(3500, 0)
    expect(Math.max(wing.start[0], wing.end[0])).toBeLessThanOrEqual(4500)
    const spec = specFromPlan({ contour: MAX_L_AXIS, wallEdgeIndices: [], params })
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const support = resolveWingShelfSupport({
      contour: MAX_L_AXIS,
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beams: frame.beams,
    })
    expect(support).not.toBeNull()
    expect(support!.lengthMm).toBeGreaterThan(4000)
    expect(support!.postPlanPoints).toHaveLength(1)
  })

  it('canonical 6×6 L: shelf at y=3000, length to notch only', () => {
    const shelf = findWingShelfSpanSegment(CANONICAL_L, 0)
    expect(shelf).not.toBeNull()
    expect(shelf!.start[1]).toBeCloseTo(3000, 0)
    expect(Math.max(shelf!.start[0], shelf!.end[0])).toBeCloseTo(3000, 0)
    expect(Math.min(shelf!.start[0], shelf!.end[0])).toBeCloseTo(0, 0)
  })
})

describe('wing shelf auto support — Midot L + purlinMaxSpanMm 4000', () => {
  /** 400@0, 300@90, 800@180, 600@270, 400@0, 300@90 (centerline). */
  const MIDOT: Point2D[] = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [-4000, 3000],
    [-4000, -3000],
    [0, -3000],
  ]

  it('legacy params without purlinMaxSpanMm do not insert a support line', () => {
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: 0 }
    delete (params as { purlinMaxSpanMm?: number }).purlinMaxSpanMm
    const spec = specFromPlan({ contour: MIDOT, wallEdgeIndices: [], params })
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const support = resolveWingShelfSupport({
      contour: MIDOT,
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beams: frame.beams,
    })
    expect(support).toBeNull()
    const model = buildPlanEditorOverlayModel({
      contour: MIDOT,
      wallEdgeIndices: [],
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    expect(model!.dividerLines.some((l) => l.dividerId === WING_SHELF_SPAN_DIVIDER_ID)).toBe(false)
  })

  it('Midot L: one support on 8000-block lower face, left inner → notch; left purlins 2 × 3250', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      wingShelfProfileId: 'F4060',
    }
    const spec = specFromPlan({ contour: MIDOT, wallEdgeIndices: [], params })
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const support = resolveWingShelfSupport({
      contour: MIDOT,
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beams: frame.beams,
    })
    expect(support).not.toBeNull()
    expect(support!.start[1]).toBeCloseTo(support!.end[1], 0)
    expect(support!.start[1]).toBeCloseTo(0, 0)
    const xMin = Math.min(support!.start[0], support!.end[0])
    const xMax = Math.max(support!.start[0], support!.end[0])
    expect(xMin).toBeGreaterThan(-4000)
    expect(xMax).toBeLessThan(20)
    expect(support!.profileId).toBe('F4060')

    const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const shelfPieces = built.pieces.filter(
      (p) => p.role === 'purlin' && p.dividerId === WING_SHELF_SPAN_DIVIDER_ID,
    )
    expect(shelfPieces).toHaveLength(1)
    expect(shelfPieces[0].profileId).toBe('F4060')

    const leftFrees = built.structuralPurlins
      .filter((p) => p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
      .map((p) => {
        const { start, end } = pieceAxis(p)
        return { len: p.lengthAxisMm, midX: (start[0] + end[0]) / 2, midY: (start[1] + end[1]) / 2 }
      })
      .filter((p) => p.midX < -20)
    const lens = leftFrees.map((p) => p.len).sort((a, b) => a - b)
    expect(lens.length).toBeGreaterThanOrEqual(2)
    for (const len of lens) {
      expect(len).toBeLessThan(4000)
      expect(len).toBeGreaterThan(2800)
    }
    const mid = (lens[0] + lens[lens.length - 1]) / 2
    expect(mid).toBeGreaterThan(2900)
    expect(mid).toBeLessThan(3300)
    const byDivider = new Map<string, number[]>()
    for (const p of built.structuralPurlins) {
      if (!p.dividerId || p.dividerId === WING_SHELF_SPAN_DIVIDER_ID) continue
      const { start, end } = pieceAxis(p)
      if ((start[0] + end[0]) / 2 >= -20) continue
      const list = byDivider.get(p.dividerId) ?? []
      list.push(p.lengthAxisMm)
      byDivider.set(p.dividerId, list)
    }
    for (const parts of byDivider.values()) {
      expect(parts).toHaveLength(2)
    }
  })
})

describe('wing shelf — live L 12000/8000/4000/3000/6500/3500', () => {
  /** Axis matching measured [4000, 3000, 8000, 3500, 12000, 6500]. */
  const LIVE_L: Point2D[] = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [11960, 3000],
    [11960, 6460],
    [0, 6460],
  ]

  it('support on notch face of 8000; left verticals ~3460 upper / ~2960 lower', () => {
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaDirectionDeg: 0, purlinMaxSpanMm: 4000 }
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [], params })
    const frame = computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const support = resolveWingShelfSupport({
      contour: LIVE_L,
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beams: frame.beams,
    })
    expect(support).not.toBeNull()
    expect(support!.start[1]).toBeCloseTo(support!.end[1], 0)
    expect(support!.start[1]).toBeCloseTo(3000, 0)
    expect(support!.lengthMm).toBeCloseTo(3960, 0)
    expect(Math.min(support!.start[0], support!.end[0])).toBeGreaterThan(0)
    expect(Math.max(support!.start[0], support!.end[0])).toBeLessThan(4000)

    const built = buildPieces(spec, PERGOLA_CONSTRUCTION_PROFILES)
    const left = built.structuralPurlins
      .filter((p) => p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
      .map((p) => {
        const { start, end } = pieceAxis(p)
        return { len: p.lengthAxisMm, midX: (start[0] + end[0]) / 2, midY: (start[1] + end[1]) / 2 }
      })
      .filter((p) => p.midX < 3900)
    const upper = left.filter((p) => p.midY > 3000).map((p) => p.len)
    const lower = left.filter((p) => p.midY < 3000).map((p) => p.len)
    expect(upper.length).toBeGreaterThan(0)
    expect(lower.length).toBeGreaterThan(0)
    // Shelf on the notch centerline y=3000. Upper 3420 + 40 band + lower 2960.
    for (const len of upper) expect(len).toBeCloseTo(3420, 0)
    for (const len of lower) expect(len).toBeCloseTo(2960, 0)
  })
})
