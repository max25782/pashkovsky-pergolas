import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { buildPlanEditorOverlayModel, outerLengthToAxisLengthMm } from '../planEditorDimensions'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'

describe('outer length edit round-trip (rectangle)', () => {
  it('target outer 3500 mm on a 3 m deep side stays within 1 mm after axis edit', () => {
    const contour: Point2D[] = [[0, 0], [4500, 0], [4500, 3000], [0, 3000]]
    const params = { ...DEFAULT_PLAN_CONSTRUCTION_PARAMS }
    const model = buildPlanEditorOverlayModel({
      contour,
      wallEdgeIndices: [],
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    expect(model).not.toBeNull()
    const side = model!.sides[1]
    const targetOuter = 3500
    const axis = outerLengthToAxisLengthMm(targetOuter, side.outerDeltaMm)
    const edited: Point2D[] = [
      [0, 0],
      [4500, 0],
      [4500, axis],
      [0, axis],
    ]
    const after = buildPlanEditorOverlayModel({
      contour: edited,
      wallEdgeIndices: [],
      params,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    expect(Math.abs(after!.sides[1].outerLengthMm - targetOuter)).toBeLessThanOrEqual(1)
  })
})
