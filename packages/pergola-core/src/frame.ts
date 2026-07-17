import type { Point2D, Vector2D, CutPiece, PergolaSpec, ProfileDimensions } from './types'
import { isCCW, computeContourMiters } from './miter'

const RAD = Math.PI / 180

// ── 2D vector helpers ─────────────────────────────────────────────────────────

function sub2(a: Point2D, b: Point2D): Vector2D { return [a[0] - b[0], a[1] - b[1]] }
function len2(v: Vector2D): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1]) }
function dist2(a: Point2D, b: Point2D): number { return len2(sub2(b, a)) }

// ── Result type ───────────────────────────────────────────────────────────────

export interface FrameResult {
  /** Horizontal perimeter beams — one per polygon edge */
  beams: CutPiece[]
  /** Vertical posts — corner posts + intermediate posts */
  posts: CutPiece[]
}

// ── Internal: miter offset for three-length calculation ───────────────────────

function miterOffset(miterDeg: number, profileWidthMm: number): number {
  return Math.tan(miterDeg * RAD) * profileWidthMm / 2
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build perimeter beams and posts for one pergola.
 *
 * BEAMS
 *   One CutPiece per polygon edge.
 *   • role: 'beam'
 *   • cutMiter* = abs(miterAngleDeg) at the adjacent vertex from miter.ts
 *   • cutHand* = cutHandOutgoing (at start) / cutHandIncoming (at end)
 *   • cutBevel* = 0  (beams are horizontal)
 *   • Three lengths computed from beam profile width, same formula as lamellas
 *   • Wall edge: uses wallProfileId if set, else beamProfileId
 *
 * POSTS
 *   • role: 'post'
 *   • Placed at every polygon vertex, EXCEPT both endpoints of the wall edge
 *     when supportType === 'wall-mounted'.
 *   • supportType === 'hanging': NO posts.
 *   • Intermediate posts added when edge length > beamProfile.maxSpanMm:
 *       nIntermediate = ceil(edgeLength / maxSpanMm) − 1
 *     Distributed uniformly along the edge (excluding endpoints).
 *   • Posts have straight cuts (miter=0, bevel=0) and vertical rotation.
 *
 * @param spec     PergolaSpec; contour auto-normalised to CCW.
 * @param profiles Map from profileId → ProfileDimensions.
 *                 Must contain postProfileId and beamProfileId (and wallProfileId if used).
 */
export function computeFrame(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): FrameResult {
  const pts: Point2D[] = isCCW(spec.contour)
    ? spec.contour
    : [...spec.contour].reverse()

  const n = pts.length
  const miters = computeContourMiters(pts)

  const supportType = spec.supportType ?? (spec.attachedToWall ? 'wall-mounted' : 'posts')

  // Resolve the wall edge index (normalised to [0, n))
  const wallIdx: number | null =
    (supportType === 'wall-mounted' && spec.wallEdgeIndex != null)
      ? ((spec.wallEdgeIndex % n) + n) % n
      : null

  const beamProfile = profiles.get(spec.beamProfileId)
  if (!beamProfile) {
    throw new Error(`Beam profile "${spec.beamProfileId}" not found in profiles map`)
  }
  const postProfile = profiles.get(spec.postProfileId)
  if (!postProfile) {
    throw new Error(`Post profile "${spec.postProfileId}" not found in profiles map`)
  }

  // ── Beams ──────────────────────────────────────────────────────────────────

  const beams: CutPiece[] = []
  let beamId = 0

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const A = pts[i]
    const B = pts[j]

    const isWallEdge = wallIdx === i

    // Wall-mounted pergola: use the wall profile on the wall edge
    const profileId = (isWallEdge && spec.wallProfileId)
      ? spec.wallProfileId
      : spec.beamProfileId

    const profile = profiles.get(profileId)
    if (!profile) {
      throw new Error(`Profile "${profileId}" not found in profiles map`)
    }

    const edgeVec = sub2(B, A)
    const edgeLen = len2(edgeVec)
    const θ = Math.atan2(edgeVec[1], edgeVec[0])

    const mS = miters[i]
    const mE = miters[j]

    const cms = Math.abs(mS.miterAngleDeg)
    const cme = Math.abs(mE.miterAngleDeg)

    const δStart = miterOffset(cms, profile.widthMm)
    const δEnd   = miterOffset(cme, profile.widthMm)

    // cutHandStart: the beam OUTGOES from vertex i → use cutHandOutgoing
    // cutHandEnd:   the beam ARRIVES at vertex j → use cutHandIncoming
    const chs = mS.cutHandOutgoing
    const che = mE.cutHandIncoming

    beams.push({
      id:       `beam-${beamId++}`,
      role:     'beam',
      profileId,

      lengthAxisMm:  edgeLen,
      lengthLongMm:  edgeLen + δStart + δEnd,
      lengthShortMm: edgeLen - δStart - δEnd,

      cutMiterStartDeg: cms,
      cutBevelStartDeg: 0,
      cutHandStart:     chs,

      cutMiterEndDeg: cme,
      cutBevelEndDeg: 0,
      cutHandEnd:     che,

      // position = start of beam at pergola height (Y is up in Three.js)
      position: [A[0], spec.heightMm, A[1]],
      // rotation around Y: negative azimuth (Three.js right-hand, Y-up convention)
      rotation: [0, -θ, 0],
      color: spec.color,
    })
  }

  // ── Posts ──────────────────────────────────────────────────────────────────

  const posts: CutPiece[] = []

  if (supportType === 'hanging') {
    return { beams, posts }
  }

  let postId = 0

  // Vertices that must NOT receive a corner post (wall attachment endpoints)
  const wallVertices = new Set<number>()
  if (wallIdx !== null) {
    wallVertices.add(wallIdx)
    wallVertices.add((wallIdx + 1) % n)
  }

  function makePost(pos: Point2D): CutPiece {
    return {
      id:       `post-${postId++}`,
      role:     'post',
      profileId: spec.postProfileId,

      lengthAxisMm:  spec.heightMm,
      lengthLongMm:  spec.heightMm,   // straight cuts both ends
      lengthShortMm: spec.heightMm,

      cutMiterStartDeg: 0,
      cutBevelStartDeg: 0,
      cutHandStart:     'straight',

      cutMiterEndDeg: 0,
      cutBevelEndDeg: 0,
      cutHandEnd:     'straight',

      // position = base of post at ground level
      position: [pos[0], 0, pos[1]],
      rotation: [0, 0, 0],
      color: spec.color,
    }
  }

  // Corner posts (one per non-wall vertex)
  for (let i = 0; i < n; i++) {
    if (!wallVertices.has(i)) {
      posts.push(makePost(pts[i]))
    }
  }

  // Intermediate posts along each edge if edge length > maxSpan
  const maxSpan = beamProfile.maxSpanMm
  if (maxSpan != null && maxSpan > 0) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const A = pts[i]
      const B = pts[j]
      const edgeLen = dist2(A, B)
      const nInter = Math.ceil(edgeLen / maxSpan) - 1
      if (nInter <= 0) continue

      for (let k = 1; k <= nInter; k++) {
        const t = k / (nInter + 1)
        const pos: Point2D = [
          A[0] + t * (B[0] - A[0]),
          A[1] + t * (B[1] - A[1]),
        ]
        posts.push(makePost(pos))
      }
    }
  }

  return { beams, posts }
}
