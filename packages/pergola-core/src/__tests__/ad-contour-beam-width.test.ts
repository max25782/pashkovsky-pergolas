import { describe, expect, it } from 'vitest'
import {
  buildPiecesFromPlan,
  contourAxesMatchEnteredOuters,
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  outerDeltaMmOnContourSideVertexRule,
  PERGOLA_CONSTRUCTION_PROFILES,
  rebuildContourForEnteredOuters,
} from '../index'
import { pieceAxis } from '../pieceAxis'

/** Saved L 12 m. Centerlines were built for a 40 mm beam (20 mm outside each convex end). */
const LIVE_L: [number, number][] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

function edgeLength(contour: [number, number][], index: number): number {
  const a = contour[index]
  const b = contour[(index + 1) % contour.length]
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

describe('entered size and the drawn beam', () => {
  it('a new plan entered with R242 already matches the typed outer', () => {
    const contour = rebuildContourForEnteredOuters({
      contour: LIVE_L,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      defaultBeamPlanWidthMm: 70,
    })
    expect(contour).not.toBeNull()
    const pts = contour as [number, number][]
    expect(contourAxesMatchEnteredOuters({
      contour: pts,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      defaultBeamPlanWidthMm: 70,
    })).toBe('match')

    const axis = edgeLength(pts, 3)
    const delta = outerDeltaMmOnContourSideVertexRule(pts, 3, 70)
    expect(axis).toBeCloseTo(3430, 0)
    expect(axis + delta).toBeCloseTo(3500, 0)
  })

  it('a saved contour built at 40 mm is not rewritten, and the drawn 70 mm beam is 30 mm long', () => {
    expect(contourAxesMatchEnteredOuters({
      contour: LIVE_L,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      defaultBeamPlanWidthMm: 70,
    })).toBe('mismatch')
    const axis = edgeLength(LIVE_L, 3)
    expect(axis).toBeCloseTo(3460, 0)
    expect(axis + 70).toBeCloseTo(3530, 0)

    const built = buildPiecesFromPlan(
      {
        contour: LIVE_L,
        wallEdgeIndices: [],
        params: {
          ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
          measuredOuterLengthMmByEdgeIndex: MEASURED,
          beamProfileId: 'R242',
          purlinProfileId: 'PA3022',
          wingShelfProfileId: 'pa1162',
        },
      },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const top = built.pieces.find((piece) => {
      if (piece.role !== 'beam') return false
      const axisLine = pieceAxis(piece)
      return Math.abs(axisLine.start[1] - 6460) < 1 && Math.abs(axisLine.end[1] - 6460) < 1
    })
    expect(top).toBeDefined()
  })

  it('a plan with no stored outer lengths is left unmarked', () => {
    expect(contourAxesMatchEnteredOuters({
      contour: LIVE_L,
      measuredOuterLengthMmByEdgeIndex: undefined,
      defaultBeamPlanWidthMm: 70,
    })).toBe('no-outers')
  })
})
