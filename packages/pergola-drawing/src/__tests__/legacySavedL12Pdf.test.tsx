// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  buildLamellaSections,
  buildPiecesFromPlan,
  buildTopPlanDimensionModel,
  contourSideWidthMm,
  lamellaRunEndWidthsMm,
  packProfile,
  DEFAULT_KERF_MM,
  resolvePlanPurlinLines,
  specFromPlan,
  type Point2D,
} from '@pashkovsky/pergola-core'
import { beamSplicePoints, groupBeamsIntoGeometricSides } from '../geometry/beamRuns'
import { renderPlanDimensionsSvg } from '../planDimensionsSvg'
import { LamellaSectionsSheet } from '../LamellaSectionsSheet'

/** Same vertices as packages/pergola-core/src/__tests__/legacySavedL12.test.ts (git 96d99e33). */
const LEGACY_SAVED_L12: Point2D[] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [11960, 3000],
  [11960, 6460],
  [0, 6460],
]
const MEASURED = [4000, 3000, 8000, 3500, 12000, 6500]

const savedParams = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'F20050',
  purlinProfileId: 'purlin-led-6040',
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
  lamellaSectionLayoutVersion: 1 as const,
  measuredOuterLengthMmByEdgeIndex: MEASURED,
}

function centroidOf(points: Point2D[]): Point2D {
  const sum = points.reduce<Point2D>((acc, point) => [acc[0] + point[0], acc[1] + point[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

describe('legacy saved L12 PDF and cut list', () => {
  it('builds the plan PDF and the section sheet without throwing', () => {
    const contour = LEGACY_SAVED_L12
    const built = buildPiecesFromPlan(
      { contour, wallEdgeIndices: [], params: savedParams },
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const beams = built.pieces.filter((piece) => piece.role === 'beam')
    const geometricSides = groupBeamsIntoGeometricSides(beams)
    const drawContour = geometricSides.map((side) => side.start)
    const centroid = centroidOf(drawContour)
    const dividerPositions = resolvePlanPurlinLines(contour, savedParams, PERGOLA_CONSTRUCTION_PROFILES, [])
    const endWidths = lamellaRunEndWidthsMm(contour, savedParams.lamellaDirectionDeg, PERGOLA_CONSTRUCTION_PROFILES, {
      wallEdgeIndices: [],
      beamProfileId: savedParams.beamProfileId,
      wallProfileId: savedParams.wallProfileId,
      wallBeamWidthVersion: savedParams.wallBeamWidthVersion,
    })
    const model = buildTopPlanDimensionModel({
      geometricSides,
      beams,
      profiles: PERGOLA_CONSTRUCTION_PROFILES,
      beamProfileId: savedParams.beamProfileId,
      centroid,
      contourVertices: contour,
      lamellaDirectionDeg: savedParams.lamellaDirectionDeg,
      dividerPositions,
      measuredOuterLengthMmByEdgeIndex: MEASURED,
      purlinClearLayoutVersion: savedParams.purlinClearLayoutVersion,
      leftEndWidthMm: endWidths.leftMm,
      rightEndWidthMm: endWidths.rightMm,
      planWidthForContourEdge: (edgeIndex: number) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
        wallEdgeIndices: [],
        beamProfileId: savedParams.beamProfileId,
        wallProfileId: savedParams.wallProfileId,
        wallBeamWidthVersion: savedParams.wallBeamWidthVersion,
      }),
    })
    const svg = renderPlanDimensionsSvg({
      contour: drawContour,
      model,
      geometricSides,
      centroid,
      lamellaDirectionDeg: savedParams.lamellaDirectionDeg,
      splicePoints: beamSplicePoints(beams),
    })
    expect(svg).toContain('<svg')

    const sections = buildLamellaSections(
      specFromPlan({ contour, wallEdgeIndices: [], params: savedParams }),
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const sheet = render(<LamellaSectionsSheet sections={sections} flowPages />)
    expect(sheet.container.querySelectorAll('svg').length).toBeGreaterThan(0)

    const cut = packProfile(
      built.pieces.filter((piece) => piece.role === 'lamella'),
      6000,
      DEFAULT_KERF_MM,
    )
    expect(cut.totalBars).toBeGreaterThan(0)
    expect(Number.isFinite(cut.totalWasteMm)).toBe(true)
  })
})
