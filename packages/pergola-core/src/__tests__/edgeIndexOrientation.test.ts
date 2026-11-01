import { describe, expect, it } from 'vitest'
import { buildPieces, specFromPlan } from '../buildPieces'
import { computeFrame } from '../frame'
import { isCCW } from '../miter'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS, type PlanConstructionParams } from '../planDefaults'
import { buildPlanEditorOverlayModel } from '../planEditorDimensions'
import { PERGOLA_CONSTRUCTION_PROFILES } from '../pergolaProfiles'
import { pieceAxis } from '../pieceAxis'
import type { CutPiece, Point2D } from '../types'

/**
 * Audit of every plan field that indexes contour edges or vertices. A plan drawn
 * clockwise stores its per-edge fields in its own edge order; the same plan drawn
 * counter-clockwise (vertices reversed) must give the same pieces. For each field
 * this builds the plan both ways, maps the field the way the editor stores it, and
 * compares the full piece fingerprint (beams, posts with their heights, purlins,
 * lamellas).
 */

const profiles = PERGOLA_CONSTRUCTION_PROFILES

const baseParams: PlanConstructionParams = {
  ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
  beamProfileId: 'pa1429',
  wallProfileId: 'f10040',
  wallBeamWidthVersion: 1,
  lamellaDirectionDeg: 0,
  purlinMaxSpanMm: 4000,
  purlinClearLayoutVersion: 1,
}

interface Shape {
  name: string
  /** Counter-clockwise contour. */
  contour: Point2D[]
}

const SHAPES: Shape[] = [
  { name: 'rectangle', contour: [[0, 0], [6000, 0], [6000, 4000], [0, 4000]] },
  {
    name: 'skew pentagon',
    contour: [[20, 20], [889.81, 20], [5877.298, 6884.61], [6269.409, 9124.567], [20, 9786.769]],
  },
  {
    name: 'L-shape',
    contour: [[0, 0], [4000, 0], [4000, 3000], [11960, 3000], [11960, 6460], [0, 6460]],
  },
]

/** Edge k of a clockwise contour is edge n - 2 - k of its counter-clockwise copy. */
const swap = (k: number, n: number) => (2 * n - 2 - (((k % n) + n) % n)) % n

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

function fingerprint(contour: Point2D[], walls: number[], params: PlanConstructionParams) {
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

/** Post heights by position: the slope or an override must raise the same physical post. */
function postHeights(contour: Point2D[], walls: number[], params: PlanConstructionParams): string[] {
  const spec = specFromPlan({ contour, wallEdgeIndices: walls, params })
  return buildPieces(spec, profiles)
    .pieces.filter((p) => p.role === 'post')
    .map((p) => {
      const at = pieceAxis(p).start
      return `${Math.round(at[0])},${Math.round(at[1])}:${Math.round(p.lengthLongMm)}`
    })
    .sort()
}

interface Pair {
  ccw: { contour: Point2D[]; walls: number[] }
  cw: { contour: Point2D[]; walls: number[] }
  /** Map a per-edge value list from counter-clockwise order to the clockwise plan's order. */
  edgeValues: <T>(values: T[]) => T[]
}

function pairOf(shape: Shape, walls: number[]): Pair {
  const n = shape.contour.length
  const cwContour = [...shape.contour].reverse()
  expect(isCCW(shape.contour)).toBe(true)
  expect(isCCW(cwContour)).toBe(false)
  return {
    ccw: { contour: shape.contour, walls },
    cw: { contour: cwContour, walls: walls.map((k) => swap(k, n)) },
    edgeValues: <T,>(values: T[]) => {
      const out = new Array<T>(n)
      for (let i = 0; i < n; i++) out[swap(i, n)] = values[i]
      return out
    },
  }
}

describe('highEdgeIndex (roof high side)', () => {
  const slope = { mode: 'deg' as const, value: 8 }

  for (const shape of SHAPES) {
    for (let high = 0; high < shape.contour.length; high++) {
      it(`${shape.name}: high edge ${high} drawn either way raises the same posts`, () => {
        const pair = pairOf(shape, [])
        const n = shape.contour.length
        const ccwParams = { ...baseParams, slope, highEdgeIndex: high }
        const cwParams = { ...baseParams, slope, highEdgeIndex: swap(high, n) }
        expect(postHeights(pair.cw.contour, [], cwParams)).toEqual(postHeights(pair.ccw.contour, [], ccwParams))
        expect(fingerprint(pair.cw.contour, [], cwParams)).toEqual(fingerprint(pair.ccw.contour, [], ccwParams))
      })
    }
  }

  for (const shape of SHAPES.slice(0, 2)) {
    for (let high = 0; high < shape.contour.length; high++) {
      it(`${shape.name}: a clockwise plan's high edge ${high} is the edge as drawn`, () => {
        const cwContour = [...shape.contour].reverse()
        const params = { ...baseParams, slope, highEdgeIndex: high }
        const spec = specFromPlan({ contour: cwContour, wallEdgeIndices: [], params })
        const posts = buildPieces(spec, profiles).pieces.filter((x) => x.role === 'post')
        const a = cwContour[high]
        const b = cwContour[(high + 1) % cwContour.length]
        const distToEdge = (x: number, y: number) =>
          Math.abs((x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1])
        const rows = posts.map((p) => {
          const at = pieceAxis(p).start
          return { dist: distToEdge(at[0], at[1]), height: p.lengthLongMm }
        })
        // Posts stand a little outside the contour axis (half a beam), so "on the edge"
        // means within 150 mm of it; that leaves at most tan(8 deg) * 150 = 21 mm of rise.
        const onEdge = rows.filter((r) => r.dist < 150)
        const away = rows.filter((r) => r.dist >= 150)
        expect(onEdge.length).toBeGreaterThan(0)
        expect(away.length).toBeGreaterThan(0)
        // Posts on the chosen edge stand at the full height, every other post is lower.
        for (const r of onEdge) expect(Math.abs(r.height - baseParams.heightMm)).toBeLessThan(25)
        for (const r of away) expect(r.height).toBeLessThan(baseParams.heightMm - 25)
      })
    }
  }

  it('a slope with walls on the same plan gives the same result drawn either way', () => {
    const shape = SHAPES[1]
    const pair = pairOf(shape, [1])
    const n = shape.contour.length
    const ccwParams = { ...baseParams, slope, highEdgeIndex: 1 }
    const cwParams = { ...baseParams, slope, highEdgeIndex: swap(1, n) }
    expect(fingerprint(pair.cw.contour, pair.cw.walls, cwParams)).toEqual(
      fingerprint(pair.ccw.contour, pair.ccw.walls, ccwParams),
    )
  })
})

describe('postHeightOverridesMm (keyed by frame post id)', () => {
  for (const shape of SHAPES) {
    it(`${shape.name}: the same override ids raise the same physical posts drawn either way`, () => {
      const pair = pairOf(shape, [])
      const frame = computeFrame(specFromPlan({ contour: pair.ccw.contour, wallEdgeIndices: [], params: baseParams }), profiles)
      const ids = frame.posts.slice(0, 2).map((p) => p.id)
      const overrides = Object.fromEntries(ids.map((id, i) => [id, 2900 + i * 100]))
      const params = { ...baseParams, postHeightOverridesMm: overrides }
      expect(postHeights(pair.cw.contour, [], params)).toEqual(postHeights(pair.ccw.contour, [], params))
    })
  }
})

describe('purlinDividers manual lines (absolute mm along the lamella direction)', () => {
  const cases: Array<[string, number]> = [['lamellas along x', 0], ['lamellas along y', 90]]
  for (const shape of SHAPES) {
    for (const [label, directionDeg] of cases) {
      it(`${shape.name}, ${label}, with a wall: the same pieces drawn either way`, () => {
        const pair = pairOf(shape, [0])
        const params: PlanConstructionParams = {
          ...baseParams,
          lamellaDirectionDeg: directionDeg,
          purlinDividers: { mode: 'manual', lines: [{ id: 'div-2500', positionMm: 2500 }] },
        }
        expect(fingerprint(pair.cw.contour, pair.cw.walls, params)).toEqual(
          fingerprint(pair.ccw.contour, pair.ccw.walls, params),
        )
      })
    }
  }
})

describe('editor overlay (typed outers read by edge index, with walls)', () => {
  for (const shape of SHAPES) {
    it(`${shape.name}: every edge shows the same axis and outer length drawn either way`, () => {
      const n = shape.contour.length
      const pair = pairOf(shape, [0])
      const outers = shape.contour.map((p, i) => {
        const q = shape.contour[(i + 1) % n]
        return Math.round(Math.hypot(q[0] - p[0], q[1] - p[1])) + 80 + 20 * i
      })
      const ccwParams: PlanConstructionParams = { ...baseParams, measuredOuterLengthMmByEdgeIndex: outers }
      const cwParams: PlanConstructionParams = {
        ...ccwParams,
        measuredOuterLengthMmByEdgeIndex: pair.edgeValues(outers),
      }
      const ccw = buildPlanEditorOverlayModel({
        contour: pair.ccw.contour, wallEdgeIndices: pair.ccw.walls, params: ccwParams, profiles,
      })
      const cw = buildPlanEditorOverlayModel({
        contour: pair.cw.contour, wallEdgeIndices: pair.cw.walls, params: cwParams, profiles,
      })
      expect(ccw).not.toBeNull()
      expect(cw).not.toBeNull()
      for (let i = 0; i < n; i++) {
        const a = ccw!.sides[i]
        const b = cw!.sides[swap(i, n)]
        expect(Math.round(b.axisLengthMm)).toBe(Math.round(a.axisLengthMm))
        expect(Math.round(b.outerLengthMm)).toBe(Math.round(a.outerLengthMm))
        // Typed outer comes back as typed.
        expect(Math.round(a.outerLengthMm)).toBe(outers[i])
      }
    })
  }
})

describe('measuredOuterLengthMmByEdgeIndex with walls and a slope together', () => {
  for (const shape of SHAPES) {
    it(`${shape.name}: typed outers, a wall and a slope drawn either way`, () => {
      const n = shape.contour.length
      const pair = pairOf(shape, [0])
      const outers = shape.contour.map((p, i) => {
        const q = shape.contour[(i + 1) % n]
        return Math.round(Math.hypot(q[0] - p[0], q[1] - p[1])) + 80 + 20 * i
      })
      const ccwParams: PlanConstructionParams = {
        ...baseParams,
        measuredOuterLengthMmByEdgeIndex: outers,
        slope: { mode: 'deg', value: 6 },
        highEdgeIndex: 1,
      }
      const cwParams: PlanConstructionParams = {
        ...ccwParams,
        measuredOuterLengthMmByEdgeIndex: pair.edgeValues(outers),
        highEdgeIndex: swap(1, n),
      }
      expect(fingerprint(pair.cw.contour, pair.cw.walls, cwParams)).toEqual(
        fingerprint(pair.ccw.contour, pair.ccw.walls, ccwParams),
      )
    })
  }
})
