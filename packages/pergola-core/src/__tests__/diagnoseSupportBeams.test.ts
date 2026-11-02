import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  diagnoseSupportBeams,
  makeStraightSupportBeam,
  specFromPlan,
  SUPPORT_BEAMS_FORMAT_VERSION,
} from '../index'
import type { Point2D } from '../types'

const RECT: Point2D[] = [
  [0, 0],
  [4000, 0],
  [4000, 6000],
  [0, 6000],
]

describe('diagnoseSupportBeams', () => {
  it('warns when the start purlin id is missing after an unsafe divider edit', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 90,
      purlinDividers: {
        mode: 'manual' as const,
        lines: [
          { id: 'row-1', positionMm: 1500 },
          { id: 'row-2', positionMm: 3000 },
        ],
      },
    }
    const beam = makeStraightSupportBeam({
      axisFromSideMm: 2000,
      from: 'min-stack',
      contour: RECT,
      startPurlinId: 'row-5',
      face: 'high',
      profileId: 'PA3022',
      widthMm: 40,
      directionDeg: 90,
      startPurlinPositionMm: 3000,
      purlinHalfMm: 20,
    })
    const raw = { formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams: [beam] }
    const spec = specFromPlan({ contour: RECT, wallEdgeIndices: [], params })
    const warnings = diagnoseSupportBeams({
      raw,
      spec,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    expect(warnings.some((w) => w.code === 'purlin-missing')).toBe(true)
    expect(warnings[0]?.message).toMatch(/Опорная балка не учтена/)
    expect(warnings[0]?.message).toMatch(/row-5/)
  })

  it('keeps unknown-format raw data diagnosable without throwing', () => {
    const params = DEFAULT_PLAN_CONSTRUCTION_PARAMS
    const spec = specFromPlan({ contour: RECT, wallEdgeIndices: [], params })
    const warnings = diagnoseSupportBeams({
      raw: { formatVersion: 99, beams: [{ id: 'x' }] },
      spec,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    expect(warnings[0]?.code).toBe('unknown-format')
    expect(warnings[0]?.message).toMatch(/Опорная балка не учтена/)
  })

  it('safe purlin move (same id, new position) does not warn when beam still resolves', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 90,
      purlinProfileId: 'PA3022',
      purlinDividers: {
        mode: 'manual' as const,
        lines: [{ id: 'row-5', positionMm: 3000 }],
      },
    }
    const beam = makeStraightSupportBeam({
      axisFromSideMm: 2000,
      from: 'min-stack',
      contour: RECT,
      startPurlinId: 'row-5',
      face: 'high',
      profileId: 'PA3022',
      widthMm: 40,
      directionDeg: 90,
      startPurlinPositionMm: 3000,
      purlinHalfMm: 20,
    })
    // Recalculate width / nudge purlin — id stays row-5.
    const moved = {
      ...params,
      purlinDividers: {
        mode: 'manual' as const,
        lines: [{ id: 'row-5', positionMm: 3100 }],
      },
    }
    const raw = { formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams: [beam] }
    const spec = specFromPlan({
      contour: RECT,
      wallEdgeIndices: [],
      params: moved,
      supportBeams: raw,
    })
    const warnings = diagnoseSupportBeams({
      raw,
      spec,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
    })
    expect(warnings.filter((w) => w.code === 'purlin-missing')).toHaveLength(0)
  })
})
