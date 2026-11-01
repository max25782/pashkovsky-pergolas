import {
  buildPiecesFromPlan,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  wallEdgeIndicesInFrameOrder,
} from '@pashkovsky/pergola-core'
import type { Point2D } from '@pashkovsky/pergola-core'
import { contourBeamEdgeIndex, piecesForCutting } from '../order-sheet'

/**
 * Wall beams are left out of the order and the cut list. The plan's wall indices count
 * the plan's own edges; beam ids count the frame's counter-clockwise copy. The same plan
 * drawn clockwise must drop the same physical beams as when drawn counter-clockwise.
 */
const params = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'pa1429',
  wallProfileId: 'f10040',
  wallBeamWidthVersion: 1 as const,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
}

const CCW: Point2D[] = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]]
const CCW_WALLS = [0]
const CW: Point2D[] = [...CCW].reverse()
const CW_WALLS = [2] // the same bottom side: edge k of the clockwise copy is n - 2 - k

function keptBeamProfiles(contour: Point2D[], walls: number[]): string[] {
  const built = buildPiecesFromPlan({ contour, wallEdgeIndices: walls, params }, PERGOLA_CONSTRUCTION_PROFILES)
  const frameWalls = wallEdgeIndicesInFrameOrder(contour, walls)
  return piecesForCutting(built.pieces, frameWalls)
    .filter((piece) => piece.role === 'beam')
    .map((piece) => `${piece.profileId}:${Math.round(piece.lengthLongMm)}`)
    .sort()
}

describe('piecesForCutting with a clockwise wall plan', () => {
  it('drops the wall beam and keeps the free beams, in either direction', () => {
    const ccw = keptBeamProfiles(CCW, CCW_WALLS)
    const cw = keptBeamProfiles(CW, CW_WALLS)
    expect(ccw.some((key) => key.startsWith('f10040:'))).toBe(false)
    expect(ccw).toHaveLength(3)
    expect(cw).toEqual(ccw)
  })

  it('without the translation the clockwise plan would drop a free beam instead', () => {
    const built = buildPiecesFromPlan({ contour: CW, wallEdgeIndices: CW_WALLS, params }, PERGOLA_CONSTRUCTION_PROFILES)
    const wrong = piecesForCutting(built.pieces, CW_WALLS).filter((piece) => piece.role === 'beam')
    expect(wrong.some((piece) => piece.profileId === 'f10040')).toBe(true)
    const right = piecesForCutting(built.pieces, wallEdgeIndicesInFrameOrder(CW, CW_WALLS)).filter(
      (piece) => piece.role === 'beam',
    )
    expect(right.some((piece) => piece.profileId === 'f10040')).toBe(false)
    expect(right.map((piece) => contourBeamEdgeIndex(piece.id)).sort()).toEqual([1, 2, 3])
  })
})
