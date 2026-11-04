/**
 * Pin contourReference on save so measured invent cannot flip centerline ↔ outer-faces.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPieces,
  paramsFromStoredPlan,
  pinContourReferenceOnParams,
  resolveContourReference,
  specFromPlan,
  WING_SHELF_SPAN_DIVIDER_ID,
} from '../index'
import type { Point2D } from '../types'

/** Offer 2026-0004 exact saved contour (no measured). */
const CONTOUR_0004: Point2D[] = [
  [0, 0],
  [-5200, 0],
  [-5200, 2350],
  [-1100, 2350],
  [-1100, 1350],
  [0, 1350],
]
const WALLS_0004 = [2, 3, 4]
const MEASURED_0004 = CONTOUR_0004.map((a, i) => {
  const b = CONTOUR_0004[(i + 1) % CONTOUR_0004.length]
  return Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))
})

const base0004 = {
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

function purlinLens(params: typeof base0004 & {
  contourReference?: 'outer-faces' | 'centerline'
  measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
}) {
  const built = buildPieces(
    specFromPlan({ contour: CONTOUR_0004, wallEdgeIndices: WALLS_0004, params }),
    PERGOLA_CONSTRUCTION_PROFILES,
  )
  return built.pieces
    .filter((p) => p.role === 'purlin' && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
    .map((p) => Math.round(p.lengthAxisMm))
    .sort((a, b) => a - b)
}

describe('pinContourReferenceOnParams', () => {
  it('pins centerline when unset and no measured (2026-0004)', () => {
    const pinned = pinContourReferenceOnParams(CONTOUR_0004, { ...base0004 })
    expect(pinned.contourReference).toBe('centerline')
    expect(resolveContourReference({
      contourReference: pinned.contourReference,
      contour: CONTOUR_0004,
      measured: MEASURED_0004,
    }).reference).toBe('centerline')
    expect(purlinLens(pinned)).toEqual([2310, 2310, 2310])
  })

  it('keeps centerline after inventing measured=edges when pinned first', () => {
    const pinned = pinContourReferenceOnParams(CONTOUR_0004, { ...base0004 })
    const afterInvent = {
      ...pinned,
      measuredOuterLengthMmByEdgeIndex: MEASURED_0004,
    }
    expect(purlinLens(afterInvent)).toEqual([2310, 2310, 2310])
    expect(
      resolveContourReference({
        contour: CONTOUR_0004,
        measured: MEASURED_0004,
      }).reference,
    ).toBe('outer-faces')
  })

  it('pins outer-faces when unset and measured equals edges (current calc)', () => {
    const pinned = pinContourReferenceOnParams(CONTOUR_0004, {
      ...base0004,
      measuredOuterLengthMmByEdgeIndex: MEASURED_0004,
    })
    expect(pinned.contourReference).toBe('outer-faces')
    expect(purlinLens(pinned)).toEqual([2270, 2270, 2270])
  })

  it('does not rewrite an explicit contourReference', () => {
    const pinned = pinContourReferenceOnParams(CONTOUR_0004, {
      ...base0004,
      contourReference: 'centerline' as const,
      measuredOuterLengthMmByEdgeIndex: MEASURED_0004,
    })
    expect(pinned.contourReference).toBe('centerline')
    expect(purlinLens(pinned)).toEqual([2310, 2310, 2310])
  })

  it('paramsFromStoredPlan pins when contour is provided', () => {
    const stored = paramsFromStoredPlan({ ...base0004 }, CONTOUR_0004)
    expect(stored.contourReference).toBe('centerline')
    const without = paramsFromStoredPlan({ ...base0004 })
    expect(without.contourReference).toBeUndefined()
  })
})
