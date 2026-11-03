/**
 * Offer contour 2026-0004: typed outers = edge lengths ⇒ outer-face classification;
 * purlin clear 2350−40−40 = 2270 (was half-trim 2310 without measured outers).
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

describe('offer 2026-0004 outer-face inset', () => {
  it('classifies contour as outer faces when measured equals every edge length', () => {
    expect(MEASURED).toEqual([5200, 2350, 4100, 1000, 1100, 1350])
    expect(contourVerticesAreOuterFaces(CONTOUR, MEASURED)).toBe(true)
    expect(contourVerticesAreOuterFaces(CONTOUR, undefined)).toBe(false)
  })

  it('shortens purlins 2310 → 2270; frame f10040 pack stock count unchanged', () => {
    const base = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      beamProfileId: 'f10040',
      wallProfileId: 'f10040',
      wallBeamWidthVersion: 1 as const,
    }
    const before = buildPieces(
      specFromPlan({ contour: CONTOUR, wallEdgeIndices: WALLS, params: base }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const after = buildPieces(
      specFromPlan({
        contour: CONTOUR,
        wallEdgeIndices: WALLS,
        params: { ...base, measuredOuterLengthMmByEdgeIndex: MEASURED },
      }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const lens = (built: typeof before) =>
      built.pieces
        .filter((p) => p.role === 'purlin' && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
        .map((p) => Math.round(p.lengthAxisMm))
        .sort((a, b) => a - b)
    expect(lens(before)).toEqual([2310, 2310, 2310])
    expect(lens(after)).toEqual([2270, 2270, 2270])

    const frame = computeFrame(
      specFromPlan({
        contour: CONTOUR,
        wallEdgeIndices: WALLS,
        params: { ...base, measuredOuterLengthMmByEdgeIndex: MEASURED },
      }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    expect(frame.beams.every((b) => b.profileId === 'f10040')).toBe(true)
    expect(frame.beams.map((b) => Math.round(b.lengthAxisMm)).sort((a, b) => a - b)).toEqual([
      1000, 1100, 1350, 2350, 4100, 5200,
    ])

    const f10040 = after.pieces.filter((p) => p.profileId === 'f10040')
    const bundle = groupCutPiecesByBundle(f10040).values().next().value as typeof f10040
    const pack = packProfile(bundle, 6500, 5)
    expect(pack.totalBars).toBe(3)
  })
})
