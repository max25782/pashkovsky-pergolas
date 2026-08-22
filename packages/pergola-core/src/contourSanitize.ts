import type { Point2D } from './types'

/**
 * Tolerance (mm) for "these two vertices are the same point" / "this vertex
 * sits on the line between its neighbours" — see prompt "дубликат-вершина
 * ломает decomposeIntoRectangles, оно схлопывается в bounding box". A
 * mouse-drawn contour from packages/plan-editor can produce a near-zero-length
 * edge (e.g. a numeric length typed as 0.01mm — see EdgeEditor.tsx/
 * SizesPanel.tsx, both only guard `mm > 0`) or three near-collinear points
 * (an edge accidentally split into two by an intermediate click). Small
 * enough to never eat a genuine short edge/angle a real pergola could have.
 */
export const SANITIZE_EPS_MM = 1

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}

/**
 * Drops consecutive vertices (including the wrap-around last→first pair)
 * that sit within `epsMm` of the previously kept vertex — a duplicate vertex
 * IS, by definition, a zero-length side, so this single pass covers both
 * "убрать идущие подряд дубликаты вершин" and "убрать стороны нулевой
 * длины" from the prompt: they are the same defect described twice.
 */
function dedupeConsecutive(pts: Point2D[], epsMm: number): Point2D[] {
  if (pts.length === 0) return pts
  const result: Point2D[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (dist(pts[i], result[result.length - 1]) > epsMm) result.push(pts[i])
  }
  // Wrap-around: the last kept point vs the very first — a closed contour
  // whose "closing" vertex duplicates the start (see toPolygon's own
  // docstring in plan-editor: it deliberately does NOT include a closing
  // duplicate, but a raw contour from elsewhere might).
  if (result.length > 1 && dist(result[result.length - 1], result[0]) <= epsMm) {
    result.pop()
  }
  return result
}

/**
 * True iff `curr` lies within `epsMm` of the straight line from `prev` to
 * `next`, AND on the segment between them (not a reversal/spike beyond
 * either endpoint) — i.e. `curr` is a redundant "three points on a line"
 * middle vertex, safe to drop without changing the polygon's shape.
 */
function isRedundantCollinear(prev: Point2D, curr: Point2D, next: Point2D, epsMm: number): boolean {
  const baseLenMm = dist(prev, next)
  if (baseLenMm < 1e-9) return false // prev≈next is a different defect — dedupeConsecutive's job, not this check's.

  const abx = next[0] - prev[0]
  const aby = next[1] - prev[1]
  const acx = curr[0] - prev[0]
  const acy = curr[1] - prev[1]

  const cross = acx * aby - acy * abx
  const perpDistMm = Math.abs(cross) / baseLenMm
  if (perpDistMm > epsMm) return false

  // dot > 0 ⇒ curr is between prev and next along the line, not a spike
  // that doubles back past one of them (see this function's own docstring).
  const cbx = next[0] - curr[0]
  const cby = next[1] - curr[1]
  const dot = acx * cbx + acy * cby
  return dot >= 0
}

/**
 * Single pass over the (already deduped) ring: drop every vertex whose
 * immediate ORIGINAL neighbours (not the still-being-built result — see
 * below) already make it collinear-redundant. Checking against the
 * original neighbours rather than the running result is deliberate and
 * still correct for a run of >1 redundant vertices in a row (e.g. a
 * straight wall clicked as 3 short segments instead of 1): each middle
 * vertex is collinear with its own immediate original neighbours
 * independently of whether ITS neighbour was also dropped, so a single pass
 * removes the whole redundant run, not just one vertex per pass.
 */
function removeCollinear(pts: Point2D[], epsMm: number): Point2D[] {
  const n = pts.length
  if (n < 4) return pts // a triangle has no redundant middle vertex to drop.
  const result: Point2D[] = []
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const curr = pts[i]
    const next = pts[(i + 1) % n]
    if (isRedundantCollinear(prev, curr, next, epsMm)) continue
    result.push(curr)
  }
  return result
}

/**
 * Clean a raw polygon contour exactly once, before it reaches ANY
 * downstream geometry (`decomposeIntoRectangles`, `computeContourMiters`,
 * lamella/purlin clipping, beam segmentation) — see prompt "санитизацию
 * ставь... на входе в computeFrame — там, где контур из редактора впервые
 * попадает в ядро": a single shared cleanup here means every one of those
 * call sites always sees a clean contour and none of them has to
 * individually defend against a mouse-drawing artifact.
 *
 * Three defects removed, in order:
 *   1. Consecutive duplicate vertices (⇒ zero-length sides — same defect).
 *   2. Redundant collinear middle vertices (three points on a line).
 *   3. A second dedupe pass — removing a collinear vertex can never CREATE a
 *      new duplicate on its own, but this stays defensive/cheap insurance
 *      rather than an assumption, and keeps the "clean input stays
 *      unchanged" contract exact for a contour that was already clean.
 *
 * A contour that collapses below 3 vertices (all sides degenerate) is
 * returned as-is — there is no valid polygon left to sanitise further, and
 * callers (`decomposeIntoRectangles`, `computeContourMiters`, ...) already
 * have their own "too few vertices" handling.
 */
export function sanitizeContour(contour: Point2D[], epsMm: number = SANITIZE_EPS_MM): Point2D[] {
  if (contour.length < 3) return contour

  let pts = dedupeConsecutive(contour, epsMm)
  if (pts.length < 3) return pts

  pts = removeCollinear(pts, epsMm)
  if (pts.length < 3) return pts

  pts = dedupeConsecutive(pts, epsMm)
  return pts
}
