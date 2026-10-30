import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { specFromPlan } from '../buildPieces'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { contourSideWidthMm } from '../beamPlanWidth'
import {
  buildLamellaSections,
  groupLamellaSectionTypes,
  reportLamellaSections,
} from '../lamellaSections'

/** Outers 5000/4000/10000/8000/5000/4000, walls on 0, 4 and 5. */
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

describe('lamella section production types — wall L 10000/5000', () => {
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'pa1429',
    wallBeamWidthVersion: 1 as const,
    wallProfileId: 'f10040',
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    purlinClearLayoutVersion: 1 as const,
    lamellaSectionLayoutVersion: 1 as const,
  }
  const widthAt = (edgeIndex: number) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
    wallEdgeIndices: WALLS,
    beamProfileId: params.beamProfileId,
    wallProfileId: params.wallProfileId,
    wallBeamWidthVersion: 1,
  })
  const axis = axisLengthsFromOuterLengthsMm({
    outerLengthsMm: OUTERS,
    angleDeg: ANGLES,
    defaultBeamPlanWidthMm: 70,
    planWidthForEdge: widthAt,
  })
  const contour = contourFrom(axis, ANGLES)
  const spec = specFromPlan({
    contour,
    wallEdgeIndices: WALLS,
    params: { ...params, measuredOuterLengthMmByEdgeIndex: OUTERS },
  })
  const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
  const schedule = groupLamellaSectionTypes(sections)

  it('groups by W×H, quantity descending, totals match the cells', () => {
    expect(schedule.types.map((t) => [t.typeId, t.count, t.sizeLabel])).toEqual([
      ['A', 7, '1359.3×3860'],
      ['B', 3, '1359.3×3930'],
      ['C', 1, '632.1×3930'],
    ])
    expect(schedule.types.map((t) => t.lamellasPerSection)).toEqual([43, 43, 43])
    expect(schedule.totalSections).toBe(11)
    expect(schedule.totalLamellas).toBe(473)
    expect(schedule.totalSections).toBe(sections.length)
    expect(schedule.totalLamellas).toBe(sections.reduce((sum, s) => sum + s.lamellaCount, 0))
  })

  it('upper H is clear 3890 − 30; faces are the wall top face and the top frame', () => {
    const upper = sections.filter((s) => Math.abs(s.heightMm - 3860) < 0.6)
    expect(upper).toHaveLength(7)
    for (const section of upper) {
      expect(section.clearHMm).toBeCloseTo(3890, 0)
      expect(section.heightMm).toBeCloseTo(section.clearHMm - 30, 0)
      expect(section.faceY1).toBe('frame')
      expect(section.faceY0 === 'support' || section.faceY0 === 'notch').toBe(true)
    }
    const sample = upper[0]
    const cellBottom = sample.minY - (sample.clearHMm - sample.heightMm) / 2
    const cellTop = sample.maxY + (sample.clearHMm - sample.heightMm) / 2
    expect(cellBottom).toBeCloseTo(20, 0)
    expect(cellTop).toBeCloseTo(3910, 0)
    expect(reportLamellaSections(upper).length).toBe(7)
  })
})
