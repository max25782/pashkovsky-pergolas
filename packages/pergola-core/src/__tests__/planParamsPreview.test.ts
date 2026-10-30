import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  DEFAULT_SUPPORT_PROFILE_ID,
  PERGOLA_CONSTRUCTION_PROFILES,
  beamProfileChangePatch,
  buildPiecesFromPlan,
  buildTopPlanDimensionModel,
  computeFrame,
  hasLongDividerWithoutSupport,
  paramsFromStoredPlan,
  planFrameAsideRows,
  contourSideWidthMm,
  lamellaRunEndWidthsMm,
  resolvePlanPurlinLines,
  supportProfileOptions,
  supportProfileNeedsChoice,
} from '../index'
import { pieceAxis } from '../pieceAxis'
import type { Point2D } from '../types'

const L12: Point2D[] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

function centroid(points: Point2D[]): Point2D {
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

describe('plan params the preview reads', () => {
  it('new plans default the support profile to 100×40 and the span to 4000', () => {
    expect(supportProfileOptions).toEqual(['f10040', 'pa1162'])
    expect(DEFAULT_SUPPORT_PROFILE_ID).toBe('f10040')
    expect(DEFAULT_PLAN_CONSTRUCTION_PARAMS.wingShelfProfileId).toBe('f10040')
    expect(DEFAULT_PLAN_CONSTRUCTION_PARAMS.purlinMaxSpanMm).toBe(4000)
    expect(supportProfileOptions).not.toContain('PA1296')
    expect(supportProfileOptions).not.toContain('F4060')
  })

  it('a saved plan that omits the span and the support profile stays omitted', () => {
    const params = paramsFromStoredPlan({ beamProfileId: 'f10040' })
    expect(params.purlinMaxSpanMm).toBeUndefined()
    expect(params.wingShelfProfileId).toBeUndefined()
    expect(supportProfileNeedsChoice('PA1296')).toBe(true)
    expect(supportProfileNeedsChoice('F4060')).toBe(true)
    expect(supportProfileNeedsChoice('purlin-plain-5030')).toBe(true)
    expect(supportProfileNeedsChoice(undefined)).toBe(false)
    expect(supportProfileNeedsChoice('f10040')).toBe(false)
  })

  it('changing the wall and the perimeter updates the chain and the frame caption the preview reads', () => {
    const stored = paramsFromStoredPlan({
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
      wallProfileId: 'f10040',
      measuredOuterLengthMmByEdgeIndex: MEASURED,
    })
    const edited = {
      ...stored,
      ...beamProfileChangePatch('R242'),
      wallProfileId: 'pa1162',
      wallBeamWidthVersion: 1 as const,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
    }
    const wallIndices = [2]
    const built = buildPiecesFromPlan(
      { contour: L12, wallEdgeIndices: wallIndices, params: edited },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(built.pieces.some((piece) => piece.role === 'beam' && piece.profileId === 'R242')).toBe(true)
    expect(built.pieces.some((piece) => piece.role === 'beam' && piece.profileId === 'pa1162')).toBe(true)
    const dividers = resolvePlanPurlinLines(L12, edited, PERGOLA_CONSTRUCTION_PROFILES, wallIndices)
    const frame = computeFrame(
      {
        contour: L12,
        heightMm: edited.heightMm,
        lamellaGapMm: edited.lamellaGapMm,
        lamellaAngleDeg: edited.lamellaAngleDeg,
        lamellaDirectionDeg: edited.lamellaDirectionDeg,
        postProfileId: edited.postProfileId,
        beamProfileId: edited.beamProfileId,
        lamellaProfileId: 'f7020',
        purlinProfileId: edited.purlinProfileId,
        color: edited.colorHex,
        wallEdgeIndices: wallIndices,
      },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const sides = frame.beams.map((beam) => {
      const axis = pieceAxis(beam)
      return { id: beam.id, start: axis.start, end: axis.end }
    })
    const sideInput = {
      wallEdgeIndices: wallIndices,
      beamProfileId: edited.beamProfileId,
      wallProfileId: edited.wallProfileId,
      wallBeamWidthVersion: edited.wallBeamWidthVersion,
    }
    const ends = lamellaRunEndWidthsMm(L12, edited.lamellaDirectionDeg, PERGOLA_CONSTRUCTION_PROFILES, sideInput)
    const model = buildTopPlanDimensionModel({
      geometricSides: sides,
      beams: frame.beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: edited.beamProfileId,
      centroid: centroid(L12),
      contourVertices: L12,
      lamellaDirectionDeg: edited.lamellaDirectionDeg,
      dividerPositions: dividers,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      purlinClearLayoutVersion: edited.purlinClearLayoutVersion,
      leftEndWidthMm: ends.leftMm,
      rightEndWidthMm: ends.rightMm,
      planWidthForContourEdge: (edgeIndex: number) =>
        contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, sideInput),
    })
    expect(edited.beamProfileId).toBe('R242')
    expect(edited.wallProfileId).toBe('pa1162')
    expect(model.purlinClearDisplaySummary?.sectionClearLabel).toBe('1282.2')
    const rows = planFrameAsideRows(L12.length, wallIndices, edited, PERGOLA_CONSTRUCTION_PROFILES)
    expect(rows.find((row) => !row.wall)?.size).toBe('142×70')
    expect(rows.find((row) => row.wall)?.size).toBe('120×40')
  })

  it('warns when the span is off and a divider is longer than 4000', () => {
    expect(hasLongDividerWithoutSupport([4000, 5123.7], undefined)).toBe(true)
    expect(hasLongDividerWithoutSupport([5123.7], 4000)).toBe(false)
    expect(hasLongDividerWithoutSupport([3000], undefined)).toBe(false)
  })
})
