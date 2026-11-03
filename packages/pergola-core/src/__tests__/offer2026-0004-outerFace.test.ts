/**
 * Offer contour 2026-0004: exact saved plan (no measured) vs measured outers.
 * Rule must not flip silently — show lengths for both.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPieces,
  computeFrame,
  contourVerticesAreOuterFaces,
  groupCutPiecesByBundle,
  packProfile,
  resolveContourReference,
  specFromPlan,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '../index'
import type { Point2D } from '../types'

const CONTOUR: Point2D[] = [
  [0, 0],
  [-5200, 0],
  [-5200, 2350],
  [-1100, 2350],
  [-1100, 1350],
  [0, 1350],
]
const WALLS = [2, 3, 4]
const MEASURED = CONTOUR.map((a, i) => {
  const b = CONTOUR[(i + 1) % CONTOUR.length]
  return Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))
})

const baseParams = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  beamProfileId: 'f10040',
  postProfileId: 'f8080',
  purlinProfileId: 'purlin-led-6040',
  lamellaPatternId: 'all-70',
  lamellaGapMm: 20,
  wallProfileId: 'f10040',
  wallBeamWidthVersion: 1 as const,
}

function purlinLens(built: ReturnType<typeof buildPieces>) {
  return built.pieces
    .filter((p) => p.role === 'purlin' && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
    .map((p) => Math.round(p.lengthAxisMm))
    .sort((a, b) => a - b)
}

describe('offer 2026-0004 outer-face inset', () => {
  it('classifies contour as outer faces when measured equals every edge length', () => {
    expect(MEASURED).toEqual([5200, 2350, 4100, 1000, 1100, 1350])
    expect(contourVerticesAreOuterFaces(CONTOUR, MEASURED)).toBe(true)
    expect(contourVerticesAreOuterFaces(CONTOUR, undefined)).toBe(false)
    expect(
      resolveContourReference({ contour: CONTOUR, measured: undefined }).reference,
    ).toBe('centerline')
    expect(
      resolveContourReference({ contour: CONTOUR, measured: MEASURED }).reference,
    ).toBe('outer-faces')
  })

  it('exact saved plan (no measured): centerline half-trim → purlins 2310; f10040 frame', () => {
    const built = buildPieces(
      specFromPlan({ contour: CONTOUR, wallEdgeIndices: WALLS, params: baseParams }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(purlinLens(built)).toEqual([2310, 2310, 2310])
    const frame = computeFrame(
      specFromPlan({ contour: CONTOUR, wallEdgeIndices: WALLS, params: baseParams }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(frame.beams.every((b) => b.profileId === 'f10040')).toBe(true)
    expect(frame.beams.map((b) => Math.round(b.lengthAxisMm)).sort((a, b) => a - b)).toEqual([
      1000, 1100, 1350, 2350, 4100, 5200,
    ])
    const f10040 = built.pieces.filter((p) => p.profileId === 'f10040')
    const bundle = groupCutPiecesByBundle(f10040).values().next().value as typeof f10040
    const pack = packProfile(bundle, 6500, 5)
    expect(pack.totalBars).toBeGreaterThan(0)
  })

  it('with measured (= edge lengths): outer-faces → purlins 2270; same frame stock family', () => {
    const after = buildPieces(
      specFromPlan({
        contour: CONTOUR,
        wallEdgeIndices: WALLS,
        params: { ...baseParams, measuredOuterLengthMmByEdgeIndex: MEASURED },
      }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(purlinLens(after)).toEqual([2270, 2270, 2270])

    const frame = computeFrame(
      specFromPlan({
        contour: CONTOUR,
        wallEdgeIndices: WALLS,
        params: { ...baseParams, measuredOuterLengthMmByEdgeIndex: MEASURED },
      }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(frame.beams.every((b) => b.profileId === 'f10040')).toBe(true)

    const f10040 = after.pieces.filter((p) => p.profileId === 'f10040')
    const bundle = groupCutPiecesByBundle(f10040).values().next().value as typeof f10040
    const pack = packProfile(bundle, 6500, 5)
    expect(pack.totalBars).toBe(3)
  })

  it('explicit contourReference outer-faces without measured still uses full insets', () => {
    const built = buildPieces(
      specFromPlan({
        contour: CONTOUR,
        wallEdgeIndices: WALLS,
        params: { ...baseParams, contourReference: 'outer-faces' },
      }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    // No measured → shelf/outer upgrade path may differ; trim faces are full width.
    expect(purlinLens(built)).toEqual([2270, 2270, 2270])
  })
})
