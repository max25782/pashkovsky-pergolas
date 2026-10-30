import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { specFromPlan } from '../buildPieces'
import { computeFrame } from '../frame'
import { computeContourMiters } from '../miter'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { contourSideWidthMm } from '../beamPlanWidth'
import { skewWallFreeCorners } from '../frameJoints'

const OUTERS = [5000, 4000, 10000, 8000, 5000, 4000]
const ANGLES = [0, 90, 180, 270, 0, 90]
const WALLS = [0, 4, 5]

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

function wallLContour(): Point2D[] {
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'pa1429',
    wallProfileId: 'f10040' as const,
    wallBeamWidthVersion: 1 as const,
  }
  const axis = axisLengthsFromOuterLengthsMm({
    outerLengthsMm: OUTERS,
    angleDeg: ANGLES,
    defaultBeamPlanWidthMm: 70,
    planWidthForEdge: (edgeIndex) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
      wallEdgeIndices: WALLS,
      beamProfileId: params.beamProfileId,
      wallProfileId: params.wallProfileId,
      wallBeamWidthVersion: 1,
    }),
  })
  return contourFrom(axis, ANGLES)
}

describe('frame joints from wall flags', () => {
  const contour = wallLContour()
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'pa1429',
    wallProfileId: 'f10040' as const,
    wallBeamWidthVersion: 1 as const,
    measuredOuterLengthMmByEdgeIndex: OUTERS,
    frameJointVersion: 1 as const,
  }

  it('free corners are 45°, a wall beam between a free side loses that width, two walls stay 45°', () => {
    const pieces = computeFrame(
      specFromPlan({ contour, wallEdgeIndices: WALLS, params }),
      PERGOLA_CONSTRUCTION_PROFILES,
    ).beams
    const beams = pieces.filter((piece) => piece.role === 'beam')
    expect(beams).toHaveLength(6)
    const cuts = beams.map((beam) => [Math.round(beam.cutMiterStartDeg), Math.round(beam.cutMiterEndDeg), Math.round(beam.lengthLongMm)])
    expect(cuts).toEqual([
      [45, 0, 4930],
      [0, 45, 4000],
      [45, 45, 10000],
      [45, 0, 8000],
      [0, 45, 4930],
      [45, 45, 4000],
    ])
  })

  it('leaves a saved plan on bisector miters when the version is unset', () => {
    const { frameJointVersion: _omit, ...saved } = params
    const pieces = computeFrame(
      specFromPlan({ contour, wallEdgeIndices: WALLS, params: saved }),
      PERGOLA_CONSTRUCTION_PROFILES,
    ).beams
    const beams = pieces.filter((piece) => piece.role === 'beam')
    for (const beam of beams) {
      expect(beam.cutMiterStartDeg).toBeCloseTo(45, 0)
      expect(beam.cutMiterEndDeg).toBeCloseTo(45, 0)
    }
  })

  it('lists a wall/free corner that is not a right angle and still cuts it at 90°', () => {
    const skewed: Point2D[] = [[0, 0], [4000, 0], [5000, 1732], [1000, 1732]]
    const miters = computeContourMiters(skewed)
    const walls = new Set([0])
    const listed = skewWallFreeCorners({
      edgeCount: skewed.length,
      isWall: (edge) => walls.has(edge),
      interiorDegAt: (vertex) => miters[vertex].interiorAngleDeg,
    })
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.every((corner) => Math.abs(corner.interiorDeg - 90) > 1.5)).toBe(true)
  })
})
