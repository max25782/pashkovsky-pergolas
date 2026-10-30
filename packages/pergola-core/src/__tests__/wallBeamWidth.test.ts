import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { specFromPlan } from '../buildPieces'
import { computeFrame } from '../frame'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { contourSideWidthMm, innerFaceClearMm, lamellaRunEndWidthsMm } from '../beamPlanWidth'
import { buildPlanEditorOverlayModel, resolveWingShelfSupport } from '../planEditorDimensions'
import { pieceAxis } from '../pieceAxis'

/** User plan: outers 5000/4000/10000/8000/5000/4000, walls on edges 0, 4, 5. */
const OUTERS = [5000, 4000, 10000, 8000, 5000, 4000]
const ANGLES = [0, 90, 180, 270, 0, 90]
const WALLS = [0, 4, 5]
const WIDTHS = [40, 70, 70, 70, 40, 40]

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

const profiles = PERGOLA_CONSTRUCTION_PROFILES

describe('wall beam plan width is always 40 mm', () => {
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'pa1429',
    wallBeamWidthVersion: 1 as const,
    wallProfileId: 'f10040',
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    purlinClearLayoutVersion: 1 as const,
  }
  const widthAt = (edgeIndex: number) => contourSideWidthMm(profiles, edgeIndex, {
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

  it('side widths: walls 40, free double-T 70', () => {
    expect(widthAt(0)).toBe(40)
    expect(widthAt(1)).toBe(70)
    expect(widthAt(2)).toBe(70)
    expect(widthAt(3)).toBe(70)
    expect(widthAt(4)).toBe(40)
    expect(widthAt(5)).toBe(40)
    expect(WIDTHS).toEqual([40, 70, 70, 70, 40, 40])
  })

  it('shelf 4890 = 5000 − 70 − 40, not one ~110 deduction', () => {
    const spec = specFromPlan({ contour, wallEdgeIndices: WALLS, params })
    const frame = computeFrame(spec, profiles)
    const support = resolveWingShelfSupport({
      contour,
      params,
      profiles,
      beams: frame.beams,
    })
    expect(support).not.toBeNull()
    const leftFree = widthAt(3)
    const notchWall = widthAt(5)
    expect(leftFree).toBe(70)
    expect(notchWall).toBe(40)
    expect(5000 - leftFree - notchWall).toBe(4890)
    expect(support!.lengthMm).toBeCloseTo(4890, 0)
    expect(innerFaceClearMm({
      axisLengthMm: 4945,
      outerLengthMm: 5000,
      startWidthMm: 70,
      endWidthMm: 40,
    })).toBe(4890)
    expect(support!.lengthMm).not.toBeCloseTo(5000 - 70 - 70, 0)
    expect(support!.lengthMm).not.toBeCloseTo(5000 - 40 - 40, 0)

    for (const beam of frame.beams) {
      const axis = pieceAxis(beam)
      const mid: Point2D = [(axis.start[0] + axis.end[0]) / 2, (axis.start[1] + axis.end[1]) / 2]
      let edge = 0
      let best = Infinity
      for (let i = 0; i < contour.length; i++) {
        const a = contour[i]
        const b = contour[(i + 1) % contour.length]
        const ex = b[0] - a[0]
        const ey = b[1] - a[1]
        const el = Math.hypot(ex, ey)
        const u0 = ex / el
        const u1 = ey / el
        const rx = mid[0] - a[0]
        const ry = mid[1] - a[1]
        const dist = Math.abs(rx * u1 - ry * u0)
        if (dist < best) {
          best = dist
          edge = i
        }
      }
      expect(beam.profileId).toBe(WALLS.includes(edge) ? 'f10040' : 'pa1429')
    }
  })

  it('wall vertices have no posts', () => {
    const spec = specFromPlan({ contour, wallEdgeIndices: WALLS, params })
    const frame = computeFrame(spec, profiles)
    const wallVertices = new Set<number>()
    for (const edge of WALLS) {
      wallVertices.add(edge)
      wallVertices.add((edge + 1) % contour.length)
    }
    for (const post of frame.posts) {
      const x = post.position[0]
      const y = post.position[2]
      for (const vertex of wallVertices) {
        const p = contour[vertex]
        expect(Math.hypot(x - p[0], y - p[1])).toBeGreaterThan(1)
      }
    }
    expect(frame.posts.length).toBeGreaterThan(0)
  })

  it('outer labels stay on the entered outers; purlin ends of the long run are both free 70', () => {
    const model = buildPlanEditorOverlayModel({
      contour,
      wallEdgeIndices: WALLS,
      params,
      profiles,
    })
    expect(model).not.toBeNull()
    const outers = model!.sides.map((s) => s.outerLengthMm)
    for (let i = 0; i < OUTERS.length; i++) {
      expect(outers[i]).toBeCloseTo(OUTERS[i], 0)
    }
    const ends = lamellaRunEndWidthsMm(contour, 0, profiles, {
      wallEdgeIndices: WALLS,
      beamProfileId: 'pa1429',
      wallProfileId: 'f10040',
      wallBeamWidthVersion: 1,
    })
    expect(ends.leftMm).toBe(70)
    expect(ends.rightMm).toBe(70)
  })

  it('saved plan without wallBeamWidthVersion does not force 40', () => {
    const legacy = contourSideWidthMm(profiles, 0, {
      wallEdgeIndices: WALLS,
      beamProfileId: 'pa1429',
    })
    expect(legacy).toBe(70)
  })
})

describe('live L shelf uses full end widths when the chord is the outer', () => {
  const LIVE_L: Point2D[] = [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [11960, 3000],
    [11960, 6460],
    [0, 6460],
  ]
  const params = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    beamProfileId: 'F20050',
    wallProfileId: 'f10040',
    wallBeamWidthVersion: 1 as const,
    lamellaDirectionDeg: 0,
    purlinMaxSpanMm: 4000,
    measuredOuterLengthMmByEdgeIndex: [4000, 3000, 8000, 3500, 12000, 6500],
  }

  it('shelf 3910 = 4000 − 50 − 40, not 4000 − 25 − 20', () => {
    const walls = [1, 2]
    const spec = specFromPlan({ contour: LIVE_L, wallEdgeIndices: walls, params })
    const frame = computeFrame(spec, profiles)
    const support = resolveWingShelfSupport({
      contour: LIVE_L,
      params,
      profiles,
      beams: frame.beams,
      wallEdgeIndices: walls,
    })
    expect(support).not.toBeNull()
    expect(support!.lengthMm).toBeCloseTo(3910, 0)
    expect(support!.lengthMm).not.toBeCloseTo(3955, 0)
    expect(innerFaceClearMm({
      axisLengthMm: 4000,
      outerLengthMm: 4000,
      startWidthMm: 50,
      endWidthMm: 40,
    })).toBe(3910)
  })
})
