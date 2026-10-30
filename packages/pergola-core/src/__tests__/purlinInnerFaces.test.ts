import { describe, expect, it } from 'vitest'
import type { Point2D } from '../types'
import {
  DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  PERGOLA_CONSTRUCTION_PROFILES,
  WING_SHELF_SPAN_DIVIDER_ID,
  buildLamellaSections,
  buildPiecesFromPlan,
  computeFrame,
  specFromPlan,
} from '../index'
import { pieceAxis } from '../pieceAxis'
import { collectFrameBeamTrimSegments } from '../dividerFrameTrim'
import { axisLengthsFromOuterLengthsMm } from '../planEditorOuterAxis'
import { contourSideWidthMm } from '../beamPlanWidth'
import type { CutPiece } from '../types'

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

function distToSeg(point: Point2D, a: Point2D, b: Point2D): number {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-6) return Math.hypot(point[0] - a[0], point[1] - a[1])
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * abx + (point[1] - a[1]) * aby) / len2))
  return Math.hypot(point[0] - (a[0] + abx * t), point[1] - (a[1] + aby * t))
}

/** A point 1 mm in from either end must stay outside every beam. Touching the face is allowed. */
function assertClearOfBeams(purlins: CutPiece[], beams: ReturnType<typeof collectFrameBeamTrimSegments>) {
  for (const piece of purlins) {
    const axis = pieceAxis(piece)
    const dx = axis.end[0] - axis.start[0]
    const dy = axis.end[1] - axis.start[1]
    const length = Math.hypot(dx, dy)
    expect(length).toBeGreaterThan(2)
    for (const t of [1 / length, 1 - 1 / length]) {
      const point: Point2D = [axis.start[0] + dx * t, axis.start[1] + dy * t]
      for (const beam of beams) {
        const inside = distToSeg(point, beam.start, beam.end) < beam.halfWidthMm - 0.5
        expect(inside).toBe(false)
      }
    }
  }
}

function purlinsOf(pieces: CutPiece[]): CutPiece[] {
  return pieces.filter((piece) => piece.role === 'purlin' && piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID)
}

describe('purlin ends on the inner faces of three other plans', () => {
  it('wall L 10 m (axis built at 70 mm) keeps face-to-face purlins and H = purlin − 30', () => {
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
      purlinProfileId: 'PA3022',
      measuredOuterLengthMmByEdgeIndex: outers,
    }
    const widthAt = (edgeIndex: number) => contourSideWidthMm(PERGOLA_CONSTRUCTION_PROFILES, edgeIndex, {
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
    const contour = contourFrom(axis, angles)
    const input = { contour, wallEdgeIndices: walls, params }
    const built = buildPiecesFromPlan(input, PERGOLA_CONSTRUCTION_PROFILES)
    const spec = specFromPlan(input)
    const purlins = purlinsOf(built.pieces)
    const beams = collectFrameBeamTrimSegments(
      computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES).beams,
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    const sections = buildLamellaSections(spec, PERGOLA_CONSTRUCTION_PROFILES)
    assertClearOfBeams(purlins, beams)
    expect(purlins.length).toBeGreaterThan(0)
    let paired = 0
    for (const piece of purlins) {
      const axisPiece = pieceAxis(piece)
      const midY = (axisPiece.start[1] + axisPiece.end[1]) / 2
      const host = sections.find((section) => midY > section.minY && midY < section.maxY)
      if (!host) continue
      expect(piece.lengthAxisMm - host.heightMm).toBeCloseTo(30, 0)
      paired += 1
    }
    expect(paired).toBe(purlins.length)
  })

  it('diagonal plan (axis built at 40 mm) leaves the 2818.9 face span and stays out of the beams', () => {
    const alpha = Math.acos(2026.3 / 3813.6) * (180 / Math.PI)
    const lengths = [1637.1, 3813.6, 4995.1, 2898.9, 8658.5, 6129.7]
    const angles = [0, alpha, 0, 90, 180, 270]
    const axis = axisLengthsFromOuterLengthsMm({
      outerLengthsMm: lengths,
      angleDeg: angles,
      defaultBeamPlanWidthMm: 40,
    })
    const contour = contourFrom(axis, angles)
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'f10040',
      lamellaGapMm: 20,
      wingShelfProfileId: 'purlin-plain-5030',
      wallBeamWidthVersion: 1 as const,
      wallProfileId: 'f10040',
      lamellaDirectionDeg: 0,
      purlinMaxSpanMm: 4000,
      purlinClearLayoutVersion: 1 as const,
      lamellaSectionLayoutVersion: 1 as const,
      frameJointVersion: 1 as const,
      skewSectionVersion: 1 as const,
      purlinProfileId: 'PA3022',
      measuredOuterLengthMmByEdgeIndex: lengths,
    }
    const input = { contour, wallEdgeIndices: [] as number[], params }
    const built = buildPiecesFromPlan(input, PERGOLA_CONSTRUCTION_PROFILES)
    const spec = specFromPlan(input)
    const purlins = purlinsOf(built.pieces)
    const beams = collectFrameBeamTrimSegments(
      computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES).beams,
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    assertClearOfBeams(purlins, beams)
    const upper = purlins.filter((piece) => {
      const axisPiece = pieceAxis(piece)
      return Math.abs(axisPiece.start[0] - axisPiece.end[0]) < 2 && piece.lengthAxisMm > 2000
    })
    const upperLengths = upper
      .map((piece) => Math.round(piece.lengthAxisMm * 10) / 10)
      .sort((a, b) => a - b)
    expect(upperLengths.filter((length) => Math.abs(length - 2818.9) < 0.6)).toHaveLength(3)
    expect(upperLengths.filter((length) => Math.abs(length - 2823.9) < 0.6)).toHaveLength(2)
  })

  it('11204 (R242, no stored outers) keeps the beam face on the beam and the shelf face off it', () => {
    const contour: Point2D[] = [
      [0, 0],
      [4068.4687027231466, 0],
      [5106.934332450832, 2553.0978158093785],
      [-6000.023638426626, 2553.09781580938],
      [-4324.502411119518, -3946.5830654311662],
      [-1096.0842946293496, -3946.5830654311662],
    ]
    const params = {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      beamProfileId: 'R242',
      purlinProfileId: 'PA3022',
      postProfileId: 'F100100',
      wingShelfProfileId: 'F4060',
      wallProfileId: 'pa1162',
    }
    const input = { contour, wallEdgeIndices: [] as number[], params }
    const built = buildPiecesFromPlan(input, PERGOLA_CONSTRUCTION_PROFILES)
    const spec = specFromPlan(input)
    const purlins = purlinsOf(built.pieces)
    const beams = collectFrameBeamTrimSegments(
      computeFrame(spec, PERGOLA_CONSTRUCTION_PROFILES).beams,
      PERGOLA_CONSTRUCTION_PROFILES,
    )
    assertClearOfBeams(purlins, beams)
    expect(purlins.map((piece) => Math.round(piece.lengthAxisMm * 10) / 10).sort((a, b) => a - b)).toEqual([
      1457, 2483.1, 2483.1, 2483.1, 2498.1, 2498.1, 2498.1, 2498.1, 2716.1, 3891.6, 3891.6,
    ])
  })
})
