import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { buildPieces, specFromPlan } from '../buildPieces'
import { DEFAULT_KERF_MM, effectiveKerfMm } from '../packProfile'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { contourSideWidthMm } from '../beamPlanWidth'

const profiles = PERGOLA_CONSTRUCTION_PROFILES

const LIVE_L: Point2D[] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]

function contourFrom(lengthsMm: number[], angleDeg: number[]): Point2D[] {
  let x = 0
  let y = 0
  const vertices: Point2D[] = [[x, y]]
  for (let i = 0; i < lengthsMm.length; i++) {
    const rad = (angleDeg[i] * Math.PI) / 180
    x += lengthsMm[i] * Math.cos(rad)
    y += lengthsMm[i] * Math.sin(rad)
    if (i < lengthsMm.length - 1) vertices.push([x, y])
  }
  return vertices
}

function slotMm(piece: { lengthLongMm: number; cutMiterStartDeg: number; cutBevelStartDeg: number; cutMiterEndDeg: number; cutBevelEndDeg: number }): number {
  const kerf = Math.max(
    effectiveKerfMm(DEFAULT_KERF_MM, piece.cutMiterStartDeg, piece.cutBevelStartDeg),
    effectiveKerfMm(DEFAULT_KERF_MM, piece.cutMiterEndDeg, piece.cutBevelEndDeg),
  )
  return piece.lengthLongMm + kerf
}

function oversize(pieces: ReturnType<typeof buildPieces>['pieces']): string[] {
  return pieces.flatMap((piece) => {
    const stock = profiles.get(piece.profileId)?.availableStockLengthsMm
    if (!stock || stock.length === 0) return []
    const maxStock = Math.max(...stock)
    const need = slotMm(piece)
    return need > maxStock + 0.5
      ? [`${piece.role} ${piece.id} ${piece.profileId} needs ${need.toFixed(1)} > stock ${maxStock}`]
      : []
  })
}

describe('pieces splice onto catalog stock', () => {
  it('live L 12000/8000/4000/3000/6500/3500: every piece fits the longest bar of its profile', () => {
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'F20050',
      purlinProfileId: 'purlin-led-6040',
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      purlinClearLayoutVersion: 1 as const,
      lamellaSectionLayoutVersion: 1 as const,
      measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 3500, 12000, 6500],
    }
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: [1, 2], params })
    const built = buildPieces(spec, profiles)
    expect(oversize(built.pieces)).toEqual([])
  })

  it('wall L 10000/5000: every piece fits the longest bar of its profile', () => {
    const outers = [5000, 4000, 10000, 8000, 5000, 4000]
    const angles = [0, 90, 180, 270, 0, 90]
    const walls = [0, 4, 5]
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'pa1429',
      wallBeamWidthVersion: 1 as const,
      wallProfileId: 'f10040',
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      purlinClearLayoutVersion: 1 as const,
      lamellaSectionLayoutVersion: 1 as const,
      measuredOuterLengthMmByEdgeIndex: outers,
    }
    const widthAt = (edgeIndex: number) => contourSideWidthMm(profiles, edgeIndex, {
      wallEdgeIndices: walls,
      beamProfileId: params.beamProfileId,
      wallProfileId: params.wallProfileId,
      wallBeamWidthVersion: 1,
    })
    const axis = axisLengthsFromOuterLengthsMm({
      outerLengthsMm: outers,
      angleDeg: angles,
      defaultBeamPlanWidthMm: 70,
      planWidthForEdge: widthAt,
    })
    const spec = specFromPlan({ contour: contourFrom(axis, angles), wallEdgeIndices: walls, params })
    const built = buildPieces(spec, profiles)
    expect(oversize(built.pieces)).toEqual([])
  })
})
