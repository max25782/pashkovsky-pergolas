import type { Point2D, Vector2D, CutPiece, PergolaSpec, ProfileDimensions } from './types'
import { isCCW } from './miter'

const DEG = 180 / Math.PI
const RAD = Math.PI / 180

/** Segments shorter than this (mm) are discarded as degenerate */
const MIN_SEGMENT_MM = 1.0

// ── 2D vector helpers ─────────────────────────────────────────────────────────

function dot2(a: Vector2D, b: Vector2D): number { return a[0] * b[0] + a[1] * b[1] }
function cross2(a: Vector2D, b: Vector2D): number { return a[0] * b[1] - a[1] * b[0] }
function sub2(a: Point2D, b: Point2D): Vector2D { return [a[0] - b[0], a[1] - b[1]] }
function len2(v: Vector2D): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1]) }

function norm2(v: Vector2D): Vector2D {
  const l = len2(v)
  return l < 1e-12 ? [0, 0] : [v[0] / l, v[1] / l]
}

function clamp2(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

// ── Scan-line / polygon clipping ──────────────────────────────────────────────

interface ScanHit {
  /** Signed distance along the scan direction (dir) from the anchor point */
  s: number
  /** Index of the polygon edge that was intersected */
  edgeIndex: number
}

/**
 * Clip an infinite scan line against a CCW polygon and return all crossings.
 *
 * Scan line: P(s) = anchor + s·dir,  dot(P, perp) = scanT
 *   dir  — unit vector along lamella direction
 *   perp — unit vector perpendicular to dir (scan axis);  dot(dir, perp) = 0
 *   scanT — position along scan axis;  dot(anchor, perp) must equal scanT
 *
 * Vertex handling (half-open interval + tangency suppression):
 *   • A vertex exactly on the scan line is counted once: by the edge whose
 *     START is that vertex [vertex → next].
 *   • If the previous and next vertices are on the SAME side of the scan line
 *     the vertex is a tangency (polygon only touches, does not cross) → NOT counted.
 *   • Collinear edges (entirely on scan line) are silently skipped.
 *
 * Returns hits sorted by s (ascending, i.e. left-to-right along dir).
 */
export function scanLineClip(
  dir: Vector2D,
  perp: Vector2D,
  scanT: number,
  anchor: Point2D,
  contour: Point2D[],
): ScanHit[] {
  const n = contour.length
  const proj = contour.map(p => dot2(p, perp))
  const EPS = 1e-9
  const hits: ScanHit[] = []

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const pA = proj[i] - scanT
    const pB = proj[j] - scanT

    const aOnLine = Math.abs(pA) < EPS
    const bOnLine = Math.abs(pB) < EPS

    // B is on the line: skip here, counted as start of the next edge
    if (bOnLine) continue

    if (aOnLine) {
      // A is on the scan line: count only if it is a CROSSING vertex
      const prevI = (i - 1 + n) % n
      const pPrev = proj[prevI] - scanT
      // Same side as B → tangency → skip
      if (Math.abs(pPrev) > EPS && pPrev * pB > 0) continue
      hits.push({ s: dot2(sub2(contour[i], anchor), dir), edgeIndex: i })
      continue
    }

    if (pA * pB >= 0) continue  // same side, no crossing

    const A = contour[i]
    const B = contour[j]
    const e = sub2(B, A)
    const w = sub2(anchor, A)
    const denom = cross2(dir, e)
    if (Math.abs(denom) < 1e-12) continue

    const s = -cross2(w, e) / denom
    hits.push({ s, edgeIndex: i })
  }

  hits.sort((a, b) => a.s - b.s)
  return hits
}

// ── Miter angle at an edge intersection ───────────────────────────────────────

/**
 * Compute the plan miter angle and hand for one lamella endpoint.
 *
 * Physical model:
 *   Each perimeter beam contains a slot whose OPENING faces perpendicular to
 *   the beam in 3D, at the installation tilt angle β.  The lamella's end face
 *   must mate with the slot entrance.
 *
 *   Working in the lamella's own coordinate frame (after laying flat on the
 *   saw table), the slot-entrance normal projects to:
 *
 *       N_saw = (cos β · s_m,  cos β · c,  sin β)
 *
 *   where  c   = dot(lamellaDir, edgeDir)   (|c|   = sin α_m)
 *           s_m = cross(edgeDir, lamellaDir)  (|s_m| = cos α_m)
 *           α_m = plan cut angle from perpendicular = asin(|c|)
 *
 *   Matching N_saw → (cos M · cos B,  sin M · cos B,  sin B) gives:
 *
 *       sin B = sin β            →  bevel B = lamellaAngleDeg (always)
 *       tan M = c / (cos β · s_m / cos β) = c / s_m
 *       |M|   = atan(|c| / |s_m|) = atan(tan α_m) = α_m
 *
 *   Key result:
 *     • cutMiterDeg = α_m  (plan cut angle, INDEPENDENT of β)
 *     • cutBevelDeg = β    (lamella tilt angle, INDEPENDENT of edge angle)
 *     • The two angles are fully decoupled.
 *
 *   Cut-sheet interpretation (matches user's example):
 *     Piece #7 | β=30°, edge slant 18.43°
 *       Table: 18.4°   (miter = plan angle)
 *       Blade: 30.0°   (bevel = lamella tilt)
 *
 * This function returns only the MITER and HAND (not the bevel — the bevel
 * is constant for all edges of a given spec and is applied by the caller).
 *
 * @param lamellaDir  Unit direction vector of the lamella in plan
 * @param contour     CCW polygon
 * @param edgeIndex   Which edge the endpoint lies on
 */
export function cutAtEdge(
  lamellaDir: Vector2D,
  contour: Point2D[],
  edgeIndex: number,
): { cutMiterDeg: number; cutHand: 'L' | 'R' | 'straight' } {
  const n = contour.length
  const A = contour[edgeIndex]
  const B = contour[(edgeIndex + 1) % n]
  const edgeDir = norm2(sub2(B, A))

  const cosAlpha = Math.abs(dot2(lamellaDir, edgeDir))  // = sin(α_m)
  const cutMiterDeg = Math.asin(clamp2(cosAlpha, 0, 1)) * DEG

  if (cutMiterDeg < 0.01) {
    return { cutMiterDeg: 0, cutHand: 'straight' }
  }

  // Interior normal of CCW edge: left of edgeDir = (-ey, ex)
  const interiorNormal: Vector2D = [-edgeDir[1], edgeDir[0]]
  const handCross = cross2(lamellaDir, interiorNormal)
  const cutHand: 'L' | 'R' = handCross > 0 ? 'L' : 'R'

  return { cutMiterDeg, cutHand }
}

// ── Long / short / axis length ────────────────────────────────────────────────

/**
 * How far the long point of a MITER cut extends beyond the centerline
 * intersection, measured along the piece's length axis.
 *
 * Only the MITER contributes to the length measurement — the bevel is a
 * rotation of the cut about the length axis, which shifts the cut in the
 * profile's height direction, not the length direction.  The long-point length
 * (what the machinist measures and marks on the bar before cutting) is:
 *
 *   lengthLongMm = lengthAxisMm + Δ_start + Δ_end
 *   Δ = tan(miterDeg) × profileWidthMm / 2
 *
 * This matches the user's formula:  lengthLong − lengthShort ≈ h × (tan a1 + tan a2)
 * where h = profileWidthMm, a1/a2 = miter angles at each end.
 *
 * @param miterDeg     Miter angle (≥ 0°)
 * @param profileWidthMm  Profile dimension perpendicular to length axis in plan
 */
export function longPointOffset(miterDeg: number, profileWidthMm: number): number {
  return Math.tan(miterDeg * RAD) * profileWidthMm / 2
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute all lamella CutPieces for one pergola specification.
 *
 * Handles arbitrary (including non-convex) polygon contours:
 *   • A convex polygon → one CutPiece per scan line.
 *   • A non-convex polygon (L, U, etc.) → 2+ independent segments per line.
 *
 * Each CutPiece includes:
 *   • Three lengths: axis (centerline), long-point, short-point.
 *   • Per end: cutMiterDeg = plan angle, cutBevelDeg = lamellaAngleDeg.
 *
 * @param spec      PergolaSpec; contour auto-normalised to CCW winding.
 * @param profiles  Map from profileId → ProfileDimensions.
 *                  Must contain the spec's lamellaProfileId.
 */
export function computeLamellas(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): CutPiece[] {
  const {
    contour, lamellaDirectionDeg, lamellaGapMm,
    lamellaAngleDeg, heightMm, color, lamellaProfileId,
  } = spec

  const profile = profiles.get(lamellaProfileId)
  if (!profile) {
    throw new Error(`Profile "${lamellaProfileId}" not found in profiles map`)
  }

  const pts: Point2D[] = isCCW(contour) ? contour : [...contour].reverse()

  const θ    = lamellaDirectionDeg * RAD
  const dir: Vector2D  = [Math.cos(θ), Math.sin(θ)]
  const perp: Vector2D = [-Math.sin(θ), Math.cos(θ)]

  const projections = pts.map(p => dot2(p, perp))
  const tMin = Math.min(...projections)
  const tMax = Math.max(...projections)

  const pieces: CutPiece[] = []
  let id = 0

  for (let scanT = tMin + lamellaGapMm * 0.5; scanT < tMax; scanT += lamellaGapMm) {
    const anchor: Point2D = [perp[0] * scanT, perp[1] * scanT]
    const hits = scanLineClip(dir, perp, scanT, anchor, pts)

    for (let k = 0; k + 1 < hits.length; k += 2) {
      const h0 = hits[k]
      const h1 = hits[k + 1]
      const lengthAxisMm = h1.s - h0.s
      if (lengthAxisMm < MIN_SEGMENT_MM) continue

      const startPt: Point2D = [
        anchor[0] + h0.s * dir[0],
        anchor[1] + h0.s * dir[1],
      ]

      const { cutMiterDeg: cms, cutHand: chs } = cutAtEdge(dir, pts, h0.edgeIndex)
      const { cutMiterDeg: cme, cutHand: che } = cutAtEdge(dir, pts, h1.edgeIndex)

      // The bevel is always the lamella's tilt angle, regardless of which edge
      const cbs = lamellaAngleDeg
      const cbe = lamellaAngleDeg

      // Three lengths: only the miter contributes to the length axis measurement
      const δStart = longPointOffset(cms, profile.widthMm)
      const δEnd   = longPointOffset(cme, profile.widthMm)
      const lengthLongMm  = lengthAxisMm + δStart + δEnd
      const lengthShortMm = lengthAxisMm - δStart - δEnd

      pieces.push({
        id:       `lamella-${id++}`,
        role:     'lamella',
        profileId: lamellaProfileId,

        lengthAxisMm,
        lengthLongMm,
        lengthShortMm,

        cutMiterStartDeg: cms,
        cutBevelStartDeg: cbs,
        cutHandStart:     chs,

        cutMiterEndDeg: cme,
        cutBevelEndDeg: cbe,
        cutHandEnd:     che,

        // plan (x, y) → world (x, heightMm, y);  Y is up in Three.js
        position: [startPt[0], heightMm, startPt[1]],
        // rotation[0]: lamella tilt; rotation[1]: azimuth (−θ: Three.js +Y goes X→−Z)
        rotation: [lamellaAngleDeg * RAD, -θ, 0],
        color,
      })
    }
  }

  return pieces
}
