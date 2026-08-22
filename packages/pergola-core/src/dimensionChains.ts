import type { CutPiece, Point2D } from './types'
import { pieceAxis } from './pieceAxis'

/**
 * ONE tick mark in an axial dimension chain, in order from the chain's
 * start (distanceFromStartMm: 0) to its end (distanceFromStartMm: edge
 * length).
 */
export interface AxialDimensionPoint {
  distanceFromStartMm: number
  point: Point2D
  /**
   * 'corner'  — one of the two polygon vertices this beam runs between.
   *             ALWAYS present as the chain's first/last point, even when
   *             no post physically sits there (e.g. a wall-mounted edge —
   *             see frame.ts: wall vertices get no corner post, but the
   *             beam/wall bracket still runs corner-to-corner, and the
   *             installer still needs that corner as a chain anchor).
   * 'post'    — an intermediate post between the two corners.
   */
  kind: 'corner' | 'post'
  /** CutPiece.id of the post this tick came from — only set for kind: 'post'. */
  postId?: string
}

export interface AxialDimensionChain {
  /** Index into the `beams` array passed in — one chain per perimeter edge, same order. */
  edgeIndex: number
  beamId: string
  /** Ordered corner → …postN… → corner, see AxialDimensionPoint. Length ≥ 2. */
  points: AxialDimensionPoint[]
  /** Consecutive segment lengths, mm — segmentsMm.length === points.length − 1. */
  segmentsMm: number[]
}

/** Perpendicular distance from a post's axis point to the beam's own line, beyond which it belongs to a DIFFERENT edge, not this one. */
const COLINEAR_EPS_MM = 5
/** How close to a corner (t≈0 or t≈edgeLen) counts as THAT corner, not a separate intermediate tick — avoids double-counting a corner post as both. */
const CORNER_EPS_MM = 5

function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}
function dot(a: Point2D, b: Point2D): number {
  return a[0] * b[0] + a[1] * b[1]
}
function len(a: Point2D): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1])
}

/**
 * The straight line one dimension chain runs along, plus a stable id for
 * it — deliberately NOT a `CutPiece`: a geometric polygon edge and "the
 * beam CutPiece(s) that happen to occupy it" are two different things once
 * a beam can be split into several stock-length pieces (see
 * `segmentBeamsForStock`) — see prompt "две независимые вещи: сторона
 * контура и то, из скольких кусков она физически сделана". A chain must
 * key off the former, never the latter, or every extra saw cut along one
 * side silently fabricates an extra chain (see prompt "артефакт презентации
 * приняли за баг расчёта" — this is exactly the bug that shape caused:
 * `buildAxialDimensionChains` below was fed one *segment* per "edge",
 * so a 2-piece side became two separate corner→corner chains instead of
 * one, and the seam between them (itself just an ordinary splice, not a
 * design corner) rendered as a phantom third dimension number).
 */
export interface AxialEdgeRef {
  start: Point2D
  end: Point2D
  id: string
}

/**
 * Build one axial (centre-to-centre) dimension chain per given geometric
 * edge, using posts as ticks (see `buildAxialDimensionChains` docstring one
 * level up for the full model — this is that same algorithm, just taking
 * the edge's line directly instead of extracting it from a single
 * `CutPiece`, so a caller can synthesize an edge that spans several
 * collinear beam segments after stock segmentation).
 */
export function buildAxialDimensionChainsFromEdges(
  edges: AxialEdgeRef[],
  posts: CutPiece[],
): AxialDimensionChain[] {
  const postAxisPoints = posts.map((post) => ({ post, point: pieceAxis(post).start }))

  return edges.map((edge, edgeIndex) => {
    const A = edge.start
    const B = edge.end
    const edgeVec = sub(B, A)
    const edgeLenMm = len(edgeVec)
    const dir: Point2D = edgeLenMm > 1e-9 ? [edgeVec[0] / edgeLenMm, edgeVec[1] / edgeLenMm] : [1, 0]
    const perp: Point2D = [-dir[1], dir[0]]

    const ticks: Array<{ distanceFromStartMm: number; point: Point2D; postId: string }> = []
    for (const { post, point } of postAxisPoints) {
      const rel = sub(point, A)
      const t = dot(rel, dir)
      const offAxisMm = Math.abs(dot(rel, perp))
      if (offAxisMm > COLINEAR_EPS_MM) continue
      if (t < CORNER_EPS_MM || t > edgeLenMm - CORNER_EPS_MM) continue // this post IS a corner, already represented below
      ticks.push({ distanceFromStartMm: t, point, postId: post.id })
    }
    ticks.sort((a, b) => a.distanceFromStartMm - b.distanceFromStartMm)

    const points: AxialDimensionPoint[] = [
      { distanceFromStartMm: 0, point: A, kind: 'corner' },
      ...ticks.map((tick) => ({
        distanceFromStartMm: tick.distanceFromStartMm,
        point: tick.point,
        kind: 'post' as const,
        postId: tick.postId,
      })),
      { distanceFromStartMm: edgeLenMm, point: B, kind: 'corner' },
    ]

    const segmentsMm = points.slice(1).map((p, i) => p.distanceFromStartMm - points[i].distanceFromStartMm)

    return { edgeIndex, beamId: edge.id, points, segmentsMm }
  })
}

/**
 * Build one axial (centre-to-centre) dimension chain PER PERIMETER BEAM.
 *
 * CORRECTED MODEL (see prompt "монтажная цепочка размеров должна идти по
 * всем стойкам вдоль стороны" — a straight rectangle side longer than
 * beamProfile.maxSpanMm gets one or more INTERMEDIATE posts, computeFrame's
 * own rule, see frame.ts computeFrame POSTS section): the chain is NOT the
 * beam's own two endpoints. A beam only supplies:
 *   • the LINE the chain runs along (its own centerline, via pieceAxis)
 *   • the chain's two ANCHOR points — the polygon corners at each end,
 *     which are chain ticks regardless of whether a corner post physically
 *     exists there (a wall edge has no corner post, but the installer still
 *     measures from that corner)
 *
 * Every TICK IN BETWEEN comes from a post whose own axis point
 * (pieceAxis(post) — a single point, since posts are vertical, see
 * pieceAxis.ts) projects onto that line: within COLINEAR_EPS_MM of it
 * perpendicular, and strictly between the two corners (a post AT a corner —
 * the free-standing case — already coincides with that corner's own tick,
 * so it is intentionally NOT re-added as a second, redundant point at
 * distance≈0 or ≈edgeLen — see CORNER_EPS_MM guard below).
 *
 * ONE CutPiece PER EDGE ONLY (see `AxialEdgeRef` docstring above): if
 * `beams` may contain several stock-segmented pieces for one polygon side,
 * use `buildAxialDimensionChainsFromEdges` with edges recombined from those
 * segments instead — calling this directly with segmented pieces produces
 * one phantom extra chain (and a phantom dimension number) per internal
 * splice.
 *
 * @param beams One chain is produced per element, same order (see
 *              computeFrame: FrameResult.beams has exactly one CutPiece per
 *              polygon edge, in polygon order).
 * @param posts All posts for this pergola (FrameResult.posts) — corner AND
 *              intermediate, undistinguished; this function figures out
 *              which belongs to which edge purely from plan geometry.
 */
export function buildAxialDimensionChains(
  beams: CutPiece[],
  posts: CutPiece[],
): AxialDimensionChain[] {
  return buildAxialDimensionChainsFromEdges(
    beams.map((beam) => {
      const { start, end } = pieceAxis(beam)
      return { start, end, id: beam.id }
    }),
    posts,
  )
}
