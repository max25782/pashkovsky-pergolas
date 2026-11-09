/** What the zone editor relies on: a check that reports instead of throwing, and one arrow per area. */
import { describe, expect, it } from 'vitest'
import { SLANTED_WING_CONTOUR_MM } from '../acceptance/slantedWingContour'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPlanEditorOverlayModel,
  checkLamellaZones,
  isAutoAddedDividerId,
  lamellaDirectionArrows,
  specFromPlan,
} from '../index'
import type { LamellaZone } from '../types'

const WING: LamellaZone = { id: 'wing', cutEdgeIndex: 2, lamellaEdgeIndex: 2, dividerEdgeIndex: 1 }

describe('checkLamellaZones', () => {
  it('accepts the wing zone', () => {
    const result = checkLamellaZones(SLANTED_WING_CONTOUR_MM, [WING])
    expect(result.applicable).toEqual([WING])
    expect(result.issues).toEqual([])
  })

  it('reports an edge that is not on the contour, with the zone id and the reason', () => {
    const bad: LamellaZone = { id: 'bad', cutEdgeIndex: 2, lamellaEdgeIndex: 99, dividerEdgeIndex: 1 }
    const result = checkLamellaZones(SLANTED_WING_CONTOUR_MM, [bad, WING])
    expect(result.applicable).toEqual([WING])
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].zoneId).toBe('bad')
    expect(result.issues[0].message).toContain('99')
  })

  it('reports lamella and divider edges that are parallel', () => {
    const parallel: LamellaZone = { id: 'p', cutEdgeIndex: 2, lamellaEdgeIndex: 2, dividerEdgeIndex: 2 }
    const result = checkLamellaZones(SLANTED_WING_CONTOUR_MM, [parallel])
    expect(result.applicable).toEqual([])
    expect(result.issues[0]?.zoneId).toBe('p')
  })
})

describe('lamellaDirectionArrows', () => {
  it('draws one arrow at the centroid when there are no zones', () => {
    const arrows = lamellaDirectionArrows(SLANTED_WING_CONTOUR_MM, undefined, 90)
    expect(arrows).toHaveLength(1)
    expect(arrows[0].zoneId).toBeNull()
    expect(arrows[0].direction[0]).toBeCloseTo(0, 9)
    expect(arrows[0].direction[1]).toBeCloseTo(1, 9)
  })

  it('draws one per zone plus one for the rest, each along its own lamellas', () => {
    const arrows = lamellaDirectionArrows(SLANTED_WING_CONTOUR_MM, [WING], 90)
    expect(arrows.map((a) => a.zoneId)).toEqual(['wing', null])
    const [wing, rest] = arrows
    expect(rest.direction[0]).toBeCloseTo(0, 9)
    expect(rest.direction[1]).toBeCloseTo(1, 9)
    expect(Math.hypot(...wing.direction)).toBeCloseTo(1, 9)
    // The wing lamellas run along the slanted side, not along the strip.
    expect(Math.abs(wing.direction[0])).toBeGreaterThan(0.1)
  })

  it('leaves an unbuildable zone out, as the build does', () => {
    const bad: LamellaZone = { id: 'bad', cutEdgeIndex: 2, lamellaEdgeIndex: 99, dividerEdgeIndex: 1 }
    expect(lamellaDirectionArrows(SLANTED_WING_CONTOUR_MM, [bad], 90).map((a) => a.zoneId)).toEqual([null])
  })
})

describe('editor overlay model', () => {
  const overlay = (zones: boolean, extra: Record<string, unknown> = {}) =>
    buildPlanEditorOverlayModel({
      contour: SLANTED_WING_CONTOUR_MM,
      wallEdgeIndices: [],
      params: {
        ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
        lamellaDirectionDeg: 90,
        contourReference: 'outer-faces',
        ...(zones ? { lamellaZones: [WING] } : {}),
        ...extra,
      } as never,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })

  it('carries one arrow per area with a zone and none without', () => {
    expect(overlay(true)?.lamellaZoneArrows.map((a) => a.zoneId)).toEqual(['wing', null])
    expect(overlay(false)?.lamellaZoneArrows).toEqual([])
  })

  it('lists the dividers the builder added, so the editor can mark them', () => {
    const added = overlay(false)?.dividerLines.filter((line) => isAutoAddedDividerId(line.dividerId)) ?? []
    expect(added.length).toBeGreaterThan(0)
  })

  it('lists none for a plan saved without the automatic dividers', () => {
    const added = overlay(false, { overhangDividerVersion: undefined })?.dividerLines
      .filter((line) => isAutoAddedDividerId(line.dividerId)) ?? []
    expect(added).toEqual([])
  })

  it('builds with an invalid zone left in the plan: the zone is left out, nothing throws', () => {
    const bad = { id: 'bad', cutEdgeIndex: 2, lamellaEdgeIndex: 99, dividerEdgeIndex: 1 }
    const spec = specFromPlan({
      contour: SLANTED_WING_CONTOUR_MM,
      wallEdgeIndices: [],
      params: { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS, lamellaZones: [bad] } as never,
    })
    expect(spec.lamellaZones).toBeUndefined()
  })
})
