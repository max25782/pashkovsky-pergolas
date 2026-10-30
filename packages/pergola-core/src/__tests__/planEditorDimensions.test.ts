import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import {
  buildPlanEditorOverlayModel,
  findWingShelfSpanSegment,
  outerLengthToAxisLengthMm,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '../planEditorDimensions'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { G_SLOPE_FIXTURE } from './topPlanDimensions.test'

const PROFILES = PERGOLA_CONSTRUCTION_PROFILES
const baseParams = () => ({ ...DEFAULT_PLAN_CONSTRUCTION_PARAMS })

describe('planEditorDimensions', () => {
  it('G fixture: one outer length per contour side', () => {
    const contour = [...G_SLOPE_FIXTURE]
    const model = buildPlanEditorOverlayModel({
      contour,
      wallEdgeIndices: [],
      params: baseParams(),
      profiles: PROFILES,
      edgeIds: ['a', 'b', 'c', 'd'],
    })
    expect(model).not.toBeNull()
    expect(model!.sides).toHaveLength(4)
    for (const side of model!.sides) {
      expect(Math.abs(side.outerLengthMm - side.axisLengthMm)).toBeLessThanOrEqual(
        Math.abs(side.outerDeltaMm) + 25,
      )
      expect(Math.abs(side.outerLengthMm - (side.axisLengthMm + 80))).toBeGreaterThan(1)
    }
    expect(model!.dimensionModel.vertexAngles).toHaveLength(4)
  })

  it('editor overlay labels a 4000 mm side as 4000, not axis plus color-chain extra', () => {
    const contour: Point2D[] = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]]
    const measured = new Map<string, number>([['a', 4000], ['b', 3000], ['c', 4000], ['d', 3000]])
    const model = buildPlanEditorOverlayModel({
      contour,
      wallEdgeIndices: [],
      params: baseParams(),
      profiles: PROFILES,
      edgeIds: ['a', 'b', 'c', 'd'],
      measuredOuterLengthMmByEdgeId: measured,
    })
    expect(model).not.toBeNull()
    expect(model!.sides[0].outerLengthMm).toBe(4000)
    expect(model!.dimensionModel.perimeterChains).toHaveLength(4)
    expect(model!.dimensionModel.perimeterChains[0].segmentsMm[0]).toBe(4000)
    expect(model!.dimensionModel.perimeterChains[0].points[1].distanceFromStartMm).toBe(4000)
    for (const side of model!.sides) {
      expect(side.outerLengthMm).toBeLessThanOrEqual((measured.get(side.edgeId) ?? side.axisLengthMm) + 0.5)
    }
  })

  it('outer length edit round-trips through axis delta', () => {
    const contour: Point2D[] = [[0, 0], [6000, 0], [6000, 3000], [0, 3000]]
    const model = buildPlanEditorOverlayModel({
      contour,
      wallEdgeIndices: [],
      params: baseParams(),
      profiles: PROFILES,
    })
    expect(model).not.toBeNull()
    const side = model!.sides[0]
    const targetOuter = side.outerLengthMm + 120
    const axis = outerLengthToAxisLengthMm(targetOuter, side.outerDeltaMm)
    const editedContour = contour.map((p, i) => (i === 1 ? [axis, p[1]] : p)) as Point2D[]
    const after = buildPlanEditorOverlayModel({
      contour: editedContour,
      wallEdgeIndices: [],
      params: baseParams(),
      profiles: PROFILES,
    })
    expect(Math.abs(after!.sides[0].outerLengthMm - targetOuter)).toBeLessThanOrEqual(1)
  })

  it('wing shelf span is collinear with notch shelf (0.1° tolerance)', () => {
    const contour = [...G_SLOPE_FIXTURE]
    const shelf = findWingShelfSpanSegment(contour)
    expect(shelf).not.toBeNull()
    expect(shelf!.start[0]).toBe(0)
    expect(shelf!.end[0]).toBeCloseTo(13002, 0)
    expect(shelf!.start[1]).toBeCloseTo(4622, 0)

    const tiltRad = (0.1 * Math.PI) / 180
    const wobble: Point2D[] = contour.map((p) => [p[0] + Math.sin(tiltRad) * p[1] * 0.001, p[1]])
    const wobbleShelf = findWingShelfSpanSegment(wobble)
    expect(wobbleShelf).not.toBeNull()
    const dx = wobbleShelf!.end[0] - wobbleShelf!.start[0]
    const dy = wobbleShelf!.end[1] - wobbleShelf!.start[1]
    const angleDeg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI
    expect(angleDeg <= 0.5 || angleDeg >= 179.5).toBe(true)

    const model = buildPlanEditorOverlayModel({
      contour,
      wallEdgeIndices: [],
      params: baseParams(),
      profiles: PROFILES,
    })
    const wing = model!.dividerLines.find((l) => l.dividerId === WING_SHELF_SPAN_DIVIDER_ID)
    expect(wing?.isWingShelfSpan).toBe(true)
    expect(Math.hypot(wing!.end[0] - wing!.start[0], wing!.end[1] - wing!.start[1])).toBeCloseTo(12962, 0)
  })
})
