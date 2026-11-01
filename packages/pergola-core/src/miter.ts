import type { Point2D, Vector2D, MiterAtVertex, ContourMiters } from './types'

// ── Vector primitives ─────────────────────────────────────────────────────────

function sub(a: Point2D, b: Point2D): Vector2D {
  return [a[0] - b[0], a[1] - b[1]]
}

function len(v: Vector2D): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1])
}

function norm(v: Vector2D): Vector2D {
  const l = len(v)
  return l < 1e-9 ? [0, 0] : [v[0] / l, v[1] / l]
}

function dot(a: Vector2D, b: Vector2D): number {
  return a[0] * b[0] + a[1] * b[1]
}

/** 2D cross product z-component: a × b */
function cross(a: Vector2D, b: Vector2D): number {
  return a[0] * b[1] - a[1] * b[0]
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

const DEG = 180 / Math.PI

/** Corners this close to 90° / 270° are treated as square (miter 45°). */
export const DEFAULT_RIGHT_ANGLE_SNAP_DEG = 1

export interface MiterOptions {
  /**
   * If `|interior − 90°|` or `|interior − 270°|` is ≤ this value, snap to
   * that right angle so the cut is exactly 45°. 0 disables snapping.
   */
  rightAngleSnapDeg?: number
}

function snapRightAngleInterior(interiorDeg: number, snapDeg: number): number {
  if (snapDeg <= 0) return interiorDeg
  if (Math.abs(interiorDeg - 90) <= snapDeg) return 90
  if (Math.abs(interiorDeg - 270) <= snapDeg) return 270
  return interiorDeg
}

// ── Polygon winding ───────────────────────────────────────────────────────────

/**
 * Signed area via the Shoelace formula.
 * Positive result → CCW winding; negative → CW winding.
 */
export function signedArea(contour: Point2D[]): number {
  let s = 0
  const n = contour.length
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

export function isCCW(contour: Point2D[]): boolean {
  return signedArea(contour) > 0
}

/**
 * Per-edge values (typed outers, ...) follow the contour's own edge order:
 * value i belongs to the edge contour[i] -> contour[i + 1].
 *
 * Core code walks a counter-clockwise copy, `[...contour].reverse()`, when the
 * contour is clockwise. Reversing the vertices [p0 .. p(n-1)] turns original
 * edge k (pk -> pk+1) into reversed edge n - 2 - k (p(k+1) -> pk), so the values
 * are re-indexed with `(n - 2 - i + n) % n`, not `(n - 1 - i) % n`. Every
 * caller that pairs a CCW copy with these values goes through here.
 *
 * Returns the input unchanged when the contour is already CCW or the lengths
 * disagree (nothing to align).
 */
export function edgeValuesInCcwOrder<T>(contour: Point2D[], values: T[] | undefined): T[] | undefined {
  if (!values || values.length !== contour.length) return values
  if (isCCW(contour)) return values
  const n = values.length
  return Array.from({ length: n }, (_, i) => values[(2 * n - 2 - i) % n])
}

/**
 * Same re-indexing as edgeValuesInCcwOrder, for a SET of edge indices (wall
 * edges, high edge): raw edge k of a clockwise contour is edge n - 2 - k of its
 * counter-clockwise copy. The mapping is its own inverse. Indices are
 * normalised to [0, n). `contour` must be the sanitised contour the indices
 * were counted on; a counter-clockwise contour is returned unchanged.
 */
export function edgeIndicesInCcwOrder(contour: Point2D[], indices: number[] | undefined): number[] | undefined {
  if (!indices || isCCW(contour)) return indices
  const n = contour.length
  if (n === 0) return indices
  return indices.map((k) => (2 * n - 2 - (((k % n) + n) % n)) % n)
}

// ── Miter at one vertex ───────────────────────────────────────────────────────

/**
 * Compute miter cut data at one polygon vertex.
 * Assumes contour is CCW-wound (use computeContourMiters for auto-normalisation).
 *
 * Math:
 *   fromPrev = normalise(prev − curr)  — unit vector along incoming beam, away from curr
 *   toNext   = normalise(next − curr)  — unit vector along outgoing beam, away from curr
 *
 *   Interior angle (measured inside the polygon):
 *     acosDeg = acos(clamp(dot(fromPrev, toNext), −1, 1))   always in [0°, 180°]
 *     crossZ  = cross(fromPrev, toNext)
 *     CCW polygon: crossZ ≤ 0 → convex vertex → interior = acosDeg
 *                  crossZ > 0 → concave vertex → interior = 360° − acosDeg
 *
 *   Miter cut angle (from perpendicular, same on both beams at the joint):
 *     miter = (180° − interior) / 2
 *     Convex (interior < 180°): miter > 0  (e.g. 90° corner → 45° miter)
 *     Straight (interior = 180°): miter = 0
 *     Concave/reflex (interior > 180°): miter < 0 (over-cut, rare in practice)
 *
 *   Cut hand (which way the bevel tilts, as seen by machinist holding the beam):
 *     bisector = normalise(fromPrev + toNext)
 *     sign of cross(beamDir, bisector) determines L or R
 */
export function miterAtVertex(
  prev: Point2D,
  curr: Point2D,
  next: Point2D,
  options?: MiterOptions,
): MiterAtVertex {
  const fromPrev = norm(sub(prev, curr))  // into incoming beam
  const toNext   = norm(sub(next, curr))  // into outgoing beam

  const d      = clamp(dot(fromPrev, toNext), -1, 1)
  const acDeg  = Math.acos(d) * DEG      // always [0°, 180°]
  const crossZ = cross(fromPrev, toNext)

  // CCW polygon: crossZ ≤ 0 → convex (left turn), crossZ > 0 → concave (right turn)
  const isConvex = crossZ <= 0
  const snapDeg = options?.rightAngleSnapDeg ?? DEFAULT_RIGHT_ANGLE_SNAP_DEG
  const rawInterior = isConvex ? acDeg : 360 - acDeg
  const interiorAngleDeg = snapRightAngleInterior(rawInterior, snapDeg)
  const miterAngleDeg    = (180 - interiorAngleDeg) / 2

  // Bisector: bisects the interior angle, perpendicular to the cut plane
  const bis = norm([fromPrev[0] + toNext[0], fromPrev[1] + toNext[1]] as Vector2D)

  // Below this miter angle (degrees) the cut is effectively straight
  const STRAIGHT_THRESH = 1e-4

  function handFromBeamDir(beamDir: Vector2D): 'L' | 'R' | 'straight' {
    if (Math.abs(miterAngleDeg) < STRAIGHT_THRESH) return 'straight'
    // cross(beamDir, bisector) > 0 → bevel tilts to the left of travel direction
    return cross(beamDir, bis) > 0 ? 'L' : 'R'
  }

  return {
    interiorAngleDeg,
    miterAngleDeg,
    isConvex,
    cutHandIncoming: handFromBeamDir(norm(sub(curr, prev))),
    cutHandOutgoing: handFromBeamDir(norm(sub(next, curr))),
  }
}

/**
 * Compute miter data for every vertex in a contour.
 * Automatically normalises to CCW winding; does not mutate the input array.
 * Throws if contour has fewer than 3 vertices.
 */
export function computeContourMiters(
  contourInput: Point2D[],
  options?: MiterOptions,
): ContourMiters {
  if (contourInput.length < 3) {
    throw new Error(`Contour must have at least 3 vertices, got ${contourInput.length}`)
  }
  // Ensure CCW so interior-angle logic is consistent
  const contour: Point2D[] = isCCW(contourInput)
    ? contourInput
    : [...contourInput].reverse()
  const n = contour.length
  return contour.map((curr, i) =>
    miterAtVertex(
      contour[(i - 1 + n) % n],
      curr,
      contour[(i + 1) % n],
      options,
    )
  )
}
