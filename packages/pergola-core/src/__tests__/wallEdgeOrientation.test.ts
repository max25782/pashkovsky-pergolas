import { describe, expect, it } from 'vitest'
import { buildPieces, specFromPlan } from '../buildPieces'
import { wallEdgeIndicesInFrameOrder } from '../frame'
import { buildLamellaSections } from '../lamellaSections'
import { edgeIndicesInCcwOrder, isCCW } from '../miter'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from '../planDefaults'
import { buildPlanEditorOverlayModel } from '../planEditorDimensions'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { resolvePlanPurlinLines } from '../dividerEdits'
import { pieceAxis } from '../pieceAxis'
import type { CutPiece, Point2D } from '../types'

/**
 * Wall edges are listed in the contour's own edge order (edge i = contour[i] ->
 * contour[i + 1], as drawn), exactly like the typed outer sizes. Core code walks a
 * counter-clockwise copy of a clockwise contour, so raw edge k becomes edge n - 2 - k
 * there. The same plan drawn either way must give the same frame, shelf, purlins,
 * sections and wall side. These tests pin that, with walls.
 */

const profiles = PERGOLA_CONSTRUCTION_PROFILES
// Free beam 70 mm wide, wall beam 40 mm (a different profile id), so a wall side can be
// told apart from a free side by the profile of the beam piece lying on it.
const FREE_BEAM = 'pa1429'
const WALL_BEAM = 'f10040'

const params = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: FREE_BEAM,
  wallProfileId: WALL_BEAM,
  wallBeamWidthVersion: 1 as const,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1 as const,
}

interface WallPlan {
  name: string
  /** Counter-clockwise contour; walls are indices into it. */
  contour: Point2D[]
  walls: number[]
}

const PLANS: WallPlan[] = [
  { name: 'rectangle, wall on the bottom side', contour: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]], walls: [0] },
  { name: 'rectangle, wall on the top side', contour: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]], walls: [2] },
  { name: 'rectangle, two walls', contour: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]], walls: [0, 1] },
  {
    name: 'skew pentagon, wall on the short bottom side',
    contour: [[20, 20], [889.81, 20], [5877.298, 6884.61], [6269.409, 9124.567], [20, 9786.769]],
    walls: [0],
  },
  {
    name: 'skew pentagon, wall on the slanted side',
    contour: [[20, 20], [889.81, 20], [5877.298, 6884.61], [6269.409, 9124.567], [20, 9786.769]],
    walls: [1],
  },
  {
    name: 'L-shape with a wing notch, three walls',
    contour: [[0, 0], [4000, 0], [4000, 3000], [11960, 3000], [11960, 6460], [0, 6460]],
    walls: [0, 2, 5],
  },
]

const raw = (k: number, n: number) => (2 * n - 2 - (((k % n) + n) % n)) % n

/** The same plan drawn the other way: vertices reversed, wall edge k becomes n - 2 - k. */
function drawnClockwise(plan: WallPlan): { contour: Point2D[]; walls: number[] } {
  const n = plan.contour.length
  return { contour: [...plan.contour].reverse(), walls: plan.walls.map((k) => raw(k, n)) }
}

function mid(a: Point2D, b: Point2D): Point2D {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function pieceKey(piece: CutPiece): string {
  const axis = pieceAxis(piece)
  const ends = [axis.start, axis.end]
    .map((p) => `${Math.round(p[0])},${Math.round(p[1])}`)
    .sort()
    .join('>')
  return [
    piece.role,
    piece.profileId,
    piece.dividerId ?? '',
    ends,
    `L${Math.round(piece.lengthLongMm)}/${Math.round(piece.lengthShortMm)}`,
    `m${piece.cutMiterStartDeg.toFixed(1)}/${piece.cutMiterEndDeg.toFixed(1)}`,
  ].join('|')
}

function fingerprint(contour: Point2D[], walls: number[]) {
  const spec = specFromPlan({ contour, wallEdgeIndices: walls, params })
  const pieces = buildPieces(spec, profiles).pieces
  const keys = (role: CutPiece['role']) => pieces.filter((p) => p.role === role).map(pieceKey).sort()
  return {
    beams: keys('beam'),
    posts: keys('post'),
    purlins: keys('purlin'),
    lamellas: keys('lamella'),
  }
}

describe('edgeIndicesInCcwOrder', () => {
  const CW: Point2D[] = [[0, 0], [0, 3960], [5960, 3960], [5960, 0]]

  it('keeps the indices of a counter-clockwise contour', () => {
    const ccw: Point2D[] = [[0, 0], [5960, 0], [5960, 3960], [0, 3960]]
    expect(edgeIndicesInCcwOrder(ccw, [0, 2])).toEqual([0, 2])
  })

  it('re-indexes a clockwise contour as n - 2 - k, like the typed outers', () => {
    expect(isCCW(CW)).toBe(false)
    expect(edgeIndicesInCcwOrder(CW, [0, 1, 2, 3])).toEqual([2, 1, 0, 3])
  })

  it('is its own inverse and normalises out-of-range indices', () => {
    const once = edgeIndicesInCcwOrder(CW, [0, 5, -1]) as number[]
    expect(once).toEqual([2, 1, 3])
    expect(edgeIndicesInCcwOrder(CW, once)).toEqual([0, 1, 3])
  })

  it('attaches each index to the same physical edge after reversing', () => {
    const contour: Point2D[] = [[0, 0], [0, 9786], [6269, 9124], [5877, 6884], [889, 0]]
    expect(isCCW(contour)).toBe(false)
    const n = contour.length
    const reversed = [...contour].reverse()
    for (let k = 0; k < n; k++) {
      const [j] = edgeIndicesInCcwOrder(contour, [k]) as number[]
      const wanted = mid(contour[k], contour[(k + 1) % n])
      const got = mid(reversed[j], reversed[(j + 1) % n])
      expect(got[0]).toBeCloseTo(wanted[0], 6)
      expect(got[1]).toBeCloseTo(wanted[1], 6)
    }
  })

  it('leaves undefined alone', () => {
    expect(edgeIndicesInCcwOrder(CW, undefined)).toBeUndefined()
  })
})

describe('wall plans: clockwise and counter-clockwise give the same result', () => {
  for (const plan of PLANS) {
    const cw = drawnClockwise(plan)

    it(`${plan.name}: drawn clockwise it really is clockwise`, () => {
      expect(isCCW(plan.contour)).toBe(true)
      expect(isCCW(cw.contour)).toBe(false)
    })

    it(`${plan.name}: frame, posts, purlins, shelf and lamellas are identical`, () => {
      expect(fingerprint(cw.contour, cw.walls)).toEqual(fingerprint(plan.contour, plan.walls))
    })

    it(`${plan.name}: lamella sections are identical`, () => {
      const sections = (contour: Point2D[], walls: number[]) =>
        buildLamellaSections(specFromPlan({ contour, wallEdgeIndices: walls, params }), profiles)
          .map((s) => [s.minX, s.maxX, s.minY, s.maxY, s.widthMm, s.heightMm].map((v) => Math.round(v * 10) / 10).join(','))
          .sort()
      expect(sections(cw.contour, cw.walls)).toEqual(sections(plan.contour, plan.walls))
    })

    it(`${plan.name}: the editor overlay and the plan purlin lines agree`, () => {
      const lines = (contour: Point2D[], walls: number[]) =>
        resolvePlanPurlinLines(contour, params, profiles, walls)
          .map((l) => Math.round(l.positionMm * 10) / 10)
          .sort((a, b) => a - b)
      expect(lines(cw.contour, cw.walls)).toEqual(lines(plan.contour, plan.walls))

      const overlay = (contour: Point2D[], walls: number[]) =>
        buildPlanEditorOverlayModel({ contour, wallEdgeIndices: walls, params, profiles })
          ?.dividerLines.map((l) => [l.start, l.end].map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).sort().join('>'))
          .sort()
      expect(overlay(cw.contour, cw.walls)).toEqual(overlay(plan.contour, plan.walls))
    })
  }
})

describe('wall side: editor, drawing sheet and calculation mark the same side', () => {
  for (const plan of PLANS) {
    for (const [label, drawn] of [
      ['counter-clockwise', { contour: plan.contour, walls: plan.walls }],
      ['clockwise', drawnClockwise(plan)],
    ] as const) {
      it(`${plan.name} (${label}): the wall beam lies on the edge the editor marks`, () => {
        const { contour, walls } = drawn
        const n = contour.length
        const spec = specFromPlan({ contour, wallEdgeIndices: walls, params })
        const beams = buildPieces(spec, profiles).pieces.filter((p) => p.role === 'beam')

        // Editor: edge k is wall -> it is the segment contour[k] -> contour[k + 1] as drawn.
        // Calculation: the beams that carry the wall profile (a long edge may be split
        // into stock lengths, so compare by lying on the edge, not by the midpoint).
        const wallBeams = beams.filter((p) => p.profileId === WALL_BEAM)
        const onSegment = (p: Point2D, a: Point2D, b: Point2D) => {
          const abx = b[0] - a[0]
          const aby = b[1] - a[1]
          const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby)))
          return Math.hypot(a[0] + t * abx - p[0], a[1] + t * aby - p[1]) < 1
        }
        const lyingOn = (piece: CutPiece, k: number) => {
          const axis = pieceAxis(piece)
          return onSegment(axis.start, contour[k], contour[(k + 1) % n]) && onSegment(axis.end, contour[k], contour[(k + 1) % n])
        }
        expect(wallBeams.length).toBeGreaterThan(0)
        for (const piece of wallBeams) expect(walls.some((k) => lyingOn(piece, k))).toBe(true)
        for (const k of walls) expect(wallBeams.some((piece) => lyingOn(piece, k))).toBe(true)
        for (const piece of beams.filter((p) => p.profileId !== WALL_BEAM)) {
          expect(walls.some((k) => lyingOn(piece, k))).toBe(false)
        }

        // Drawing sheet / cut list: beam ids `beam-<k>` count the frame's own copy; the
        // translated wall indices must name exactly the wall beams.
        const frameWalls = wallEdgeIndicesInFrameOrder(contour, walls)
        const wallBeamIds = new Set(
          wallBeams.map((p) => /^beam-(\d+)/.exec(p.id)?.[1]).filter((v): v is string => v != null).map(Number),
        )
        expect(new Set(frameWalls)).toEqual(wallBeamIds)
      })
    }
  }
})
