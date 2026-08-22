import type { Point2D, Vector2D, CutPiece, PergolaSpec, ProfileDimensions } from './types'
import { isCCW, computeContourMiters } from './miter'
import {
  decomposeIntoRectangles,
  findWingBoundariesAlongSegment,
  buildShapeGrid,
  isOrthogonalContour,
  type ShapeGrid,
} from './rectangleDecomposition'
import { sanitizeContour } from './contourSanitize'

/** Tolerance for "is this grid coordinate actually ON this edge" / "does it
 * coincide with this edge's own wing-boundary post", mm — same role as
 * rectangleDecomposition.ts's own WING_EPS_MM, kept local so this module
 * doesn't need a value-level re-export just for a tolerance constant. */
const EDGE_EPS_MM = 1

const RAD = Math.PI / 180

/** Segments shorter than this (mm) are discarded as degenerate — same threshold as lamellas.ts. */
const MIN_SEGMENT_MM = 1.0

// ── 2D vector helpers ─────────────────────────────────────────────────────────

function sub2(a: Point2D, b: Point2D): Vector2D { return [a[0] - b[0], a[1] - b[1]] }
function len2(v: Vector2D): number { return Math.sqrt(v[0] * v[0] + v[1] * v[1]) }
function dist2(a: Point2D, b: Point2D): number { return len2(sub2(b, a)) }

// ── Result type ───────────────────────────────────────────────────────────────

export interface FrameResult {
  /** Horizontal perimeter beams — one per polygon edge (or, under вистур, one per bay — see computeFrame) */
  beams: CutPiece[]
  /** Vertical posts — corner posts + intermediate posts */
  posts: CutPiece[]
  /**
   * True iff the contour is strictly axis-aligned (see
   * `isOrthogonalContour`) — the post/beam layout above is then EXACT
   * (shape-wide grid, mandatory wing boundaries). False means the layout
   * fell back to the pre-grid, per-edge-only computation (see
   * `edgeSegmentPlans` below) — still a full, non-crashing result, but only
   * an APPROXIMATION for a genuinely non-orthogonal shape (a diagonal wall,
   * a trapezoid): posts on parallel sides are no longer guaranteed to
   * align. Callers/UI must surface this — see prompt "честная плашка для
   * неортогональных форм" — not silently trust an approximate layout as if
   * it were exact.
   */
  isOrthogonal: boolean
}

// ── Internal: miter offset for three-length calculation ───────────────────────

function miterOffset(miterDeg: number, profileWidthMm: number): number {
  return Math.tan(miterDeg * RAD) * profileWidthMm / 2
}

/**
 * Fractional positions (0, 1) along an edge where INTERMEDIATE posts land,
 * when the edge is longer than the profile's maxSpanMm. Shared by the
 * intermediate-post placement loop AND (under вистур) the beam
 * segmentation loop below, so the two can never disagree about where a
 * post actually is — see prompt "не гадать в размерах цеха".
 */
function intermediatePostTs(edgeLenMm: number, maxSpanMm: number | undefined): number[] {
  if (maxSpanMm == null || maxSpanMm <= 0) return []
  const nInter = Math.ceil(edgeLenMm / maxSpanMm) - 1
  if (nInter <= 0) return []
  const ts: number[] = []
  for (let k = 1; k <= nInter; k++) ts.push(k / (nInter + 1))
  return ts
}

/**
 * One contour edge's full segmentation plan: the shape-driven wing
 * boundaries (mandatory regardless of maxSpanMm — see
 * `findWingBoundariesAlongSegment`) AND, independently inside EACH
 * resulting wing, the maxSpanMm-driven intermediate points — see prompt
 * "maxSpanMm-стойки ставятся ПОСЛЕ деления на прямоугольники, не до".
 *
 * `intraWingSpanPointsMm` deliberately does NOT include
 * `wingBoundariesMm` itself: planting a post AT a wing boundary remains
 * `segmentBeamsForStock`'s own job, unchanged (see prompt
 * "segmentBeamsForStock не трогать") — this only fixes WHERE maxSpanMm
 * looks for intermediate spans (per wing, not per whole raw edge).
 */
interface EdgeSegmentPlan {
  wingBoundariesMm: number[]
  intraWingSpanPointsMm: number[]
}

/**
 * SINGLE calculation for one edge, called ONCE per edge and consumed by
 * BOTH the corner/intermediate post-placement loop AND (under вистур) the
 * beam bay-segmentation loop below — see prompt "не по уговору в
 * комментарии, а по конструкции": there used to be two separate
 * `intermediatePostTs(edgeLen, maxSpan)` call sites (posts loop, вистур
 * beam loop) that a comment merely PROMISED would agree; a change to one
 * without the other would silently desync them. Both now read the same
 * `EdgeSegmentPlan` for the same edge index, so they cannot structurally
 * diverge.
 *
 * For a non-orthogonal contour/edge (`wingBoundariesMm === []`, e.g. a
 * trapezoid or a diagonal closing edge — see
 * findWingBoundariesAlongSegment's own docstring), this reduces to exactly
 * the old behaviour: one "wing" spanning the whole edge, maxSpanMm applied
 * to its full length — see beamSegmentation.test.ts / frame.test.ts
 * regressions for a plain rectangle.
 */
function planEdgeSegments(
  edgeLenMm: number,
  wingBoundariesMm: number[],
  maxSpanMm: number | undefined,
): EdgeSegmentPlan {
  const wingEdgesMm = [0, ...wingBoundariesMm, edgeLenMm]
  const intraWingSpanPointsMm: number[] = []
  for (let w = 0; w + 1 < wingEdgesMm.length; w++) {
    const wingStartMm = wingEdgesMm[w]
    const wingLenMm = wingEdgesMm[w + 1] - wingStartMm
    for (const t of intermediatePostTs(wingLenMm, maxSpanMm)) {
      intraWingSpanPointsMm.push(wingStartMm + t * wingLenMm)
    }
  }
  intraWingSpanPointsMm.sort((a, b) => a - b)
  return { wingBoundariesMm, intraWingSpanPointsMm }
}

/**
 * Same contract as `planEdgeSegments`, but reads `intraWingSpanPointsMm`
 * from the shape-wide `ShapeGrid` (see prompt "единая сетка стоек через
 * всю форму") instead of dividing this edge's own wing length in
 * isolation. This is what makes two parallel edges (a shape's "top" and
 * "bottom") land their maxSpanMm posts on the SAME absolute coordinates:
 * both read the same `shapeGrid.xGrid`/`yGrid`, built once for the whole
 * contour — see `buildShapeGrid`'s own docstring.
 *
 * A grid coordinate only becomes a point on THIS edge if projecting it
 * onto the edge's own axis lands strictly inside `(0, edgeLenMm)` — a wall
 * that is real for some OTHER edge but doesn't physically reach this one
 * (e.g. a short wing whose far end never gets near a distant wall) is
 * naturally excluded here, not planted "in the air" past this edge's own
 * end (see prompt "стойка не ставится за концом короткого крыла").
 */
function edgeSegmentPlanFromGrid(
  A: Point2D,
  B: Point2D,
  wingBoundariesMm: number[],
  shapeGrid: ShapeGrid,
): EdgeSegmentPlan {
  const edgeLenMm = dist2(A, B)
  if (edgeLenMm <= 1e-6) return { wingBoundariesMm, intraWingSpanPointsMm: [] }

  const dir: Vector2D = [(B[0] - A[0]) / edgeLenMm, (B[1] - A[1]) / edgeLenMm]
  const isHorizontal = Math.abs(dir[1]) <= 1e-6
  const isVertical = Math.abs(dir[0]) <= 1e-6

  const axisGrid = isHorizontal ? shapeGrid.xGrid : isVertical ? shapeGrid.yGrid : null
  if (!axisGrid) return { wingBoundariesMm, intraWingSpanPointsMm: [] }

  const candidatesAbs = [...axisGrid.wallsMm, ...axisGrid.intermediatesMm]

  const raw: number[] = []
  for (const coordAbs of candidatesAbs) {
    const distMm = isHorizontal ? (coordAbs - A[0]) * dir[0] : (coordAbs - A[1]) * dir[1]
    if (distMm <= EDGE_EPS_MM || distMm >= edgeLenMm - EDGE_EPS_MM) continue // not physically on this edge
    if (wingBoundariesMm.some((w) => Math.abs(w - distMm) <= EDGE_EPS_MM)) continue // already a wing-boundary post
    raw.push(distMm)
  }
  raw.sort((a, b) => a - b)

  const intraWingSpanPointsMm: number[] = []
  for (const d of raw) {
    if (intraWingSpanPointsMm.length === 0 || d - intraWingSpanPointsMm[intraWingSpanPointsMm.length - 1] > EDGE_EPS_MM) {
      intraWingSpanPointsMm.push(d)
    }
  }
  return { wingBoundariesMm, intraWingSpanPointsMm }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build perimeter beams and posts for one pergola.
 *
 * BEAMS
 *   Default (spec.visturTolerances undefined): ONE CutPiece per polygon
 *   edge, spanning corner to corner even when intermediate posts sit
 *   along it (pre-existing behaviour, unchanged — see frame.test.ts).
 *
 *   Вистур (spec.visturTolerances set — see visturTolerances.ts "TWO AXES,
 *   TWO PARTS"): the beam over an edge is a factory-welded piece, so it
 *   can no longer run continuously past an intermediate post — it is
 *   split into one segment PER BAY (between each pair of adjacent posts
 *   along that edge, corner or intermediate), exactly like a lamella
 *   splits at purlin crossings (see computeLamellas). EVERY segment
 *   boundary on this axis is a post, so — unlike the lamella case, where
 *   only the two OUTER ends are retracted — EACH segment loses
 *   beamSegmentReductionMm/2 off BOTH its ends (an outer end only if a
 *   post is actually there: a wall-mounted edge's vertex has no post, a
 *   bracket takes its place, so that end keeps the full span and its real
 *   corner miter, exactly as in the non-вистур case). Internal
 *   (post-crossing) ends are always straight cuts (miter=0), the same
 *   pattern used at purlin crossings in computeLamellas.
 *   NOTE: 'hanging' support has no posts at all, so вистур segmentation
 *   is skipped for it — the "welded gap at a post" concept does not apply
 *   and there is nothing to retract against; beams stay one piece per
 *   edge exactly as in the default case.
 *   • role: 'beam'
 *   • cutMiter / cutHand = the real corner miter only at an outer end that
 *     is a real post-free-standing corner (or the far end of a
 *     non-вистур/legacy edge); straight everywhere else under вистур.
 *   • cutBevel* = 0  (beams are horizontal)
 *   • Three lengths computed from beam profile width, same formula as lamellas
 *   • Wall edge: uses wallProfileId if set, else beamProfileId
 *
 * POSTS
 *   • role: 'post'
 *   • Placed at every polygon vertex, EXCEPT vertices that are an endpoint of
 *     ANY wall edge (spec.wallEdgeIndices) when supportType === 'wall-mounted'.
 *   • supportType === 'hanging': NO posts.
 *   • Intermediate posts added when edge length > beamProfile.maxSpanMm:
 *       nIntermediate = ceil(edgeLength / maxSpanMm) − 1
 *     Distributed uniformly along the edge (excluding endpoints) — see
 *     intermediatePostTs, the SAME helper the вистур beam segmentation
 *     above uses, so positions never diverge between the two.
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
  // Sanitise ONCE, right where the editor's raw contour first enters the
  // core (see prompt "санитизацию ставь... на входе в computeFrame — там,
  // где контур из редактора впервые попадает в ядро") — a duplicate/
  // near-duplicate vertex (e.g. a numeric edge length typed as ~0mm in
  // plan-editor's SizesPanel/EdgeEditor) otherwise reaches
  // decomposeIntoRectangles as a degenerate edge, which collapses the whole
  // decomposition to the contour's bounding box instead of the real
  // per-wing rectangles — every piece of geometry below (miters,
  // decomposition, wing boundaries, beam/post segmentation) then reads this
  // ONE cleaned `pts`, never the raw `spec.contour` again.
  const cleanContour = sanitizeContour(spec.contour)
  const pts: Point2D[] = isCCW(cleanContour)
    ? cleanContour
    : [...cleanContour].reverse()

  const n = pts.length
  const miters = computeContourMiters(pts)

  const supportType = spec.supportType ?? (spec.attachedToWall ? 'wall-mounted' : 'posts')

  // Resolve wall edge indices (normalised to [0, n)) — a Set, so "is edge i a
  // wall edge" and "is vertex i an endpoint of some wall edge" are both O(1).
  const wallEdgeIndices = new Set<number>(
    supportType === 'wall-mounted' && spec.wallEdgeIndices != null
      ? spec.wallEdgeIndices.map((i) => ((i % n) + n) % n)
      : [],
  )

  const beamProfile = profiles.get(spec.beamProfileId)
  if (!beamProfile) {
    throw new Error(`Beam profile "${spec.beamProfileId}" not found in profiles map`)
  }
  const postProfile = profiles.get(spec.postProfileId)
  if (!postProfile) {
    throw new Error(`Post profile "${spec.postProfileId}" not found in profiles map`)
  }
  const maxSpan = beamProfile.maxSpanMm

  // Shape-driven wing boundaries + maxSpanMm intermediate points, per edge —
  // computed ONCE, here, BEFORE either the beam or the post loop below, so
  // both read the exact same plan for the same edge (see
  // planEdgeSegments's own docstring / prompt "maxSpanMm-стойки ставятся
  // ПОСЛЕ деления на прямоугольники, не до"). `rectangles` is `null` for a
  // non-orthogonal contour — findWingBoundariesAlongSegment then returns []
  // for every edge, and this reduces to the pre-existing whole-edge
  // maxSpanMm behaviour.
  const rectangles = decomposeIntoRectangles(pts)
  const shapeGrid = buildShapeGrid(pts, rectangles, maxSpan)
  // Honest, user-facing flag — deliberately its OWN strict check, NOT
  // `rectangles != null` (see `isOrthogonalContour`'s own docstring for why
  // the two tolerances differ on purpose).
  const isOrthogonal = isOrthogonalContour(pts)
  const edgeSegmentPlans: EdgeSegmentPlan[] = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const A = pts[i]
    const B = pts[j]
    const wingBoundariesMm = findWingBoundariesAlongSegment(A, B, rectangles)
    edgeSegmentPlans.push(
      shapeGrid != null
        ? edgeSegmentPlanFromGrid(A, B, wingBoundariesMm, shapeGrid)
        // Non-orthogonal contour (rectangles === null, wingBoundariesMm always
        // []) — fall back to the pre-grid per-edge computation, byte-for-byte
        // (see prompt "Fallback на трапецию byte-for-byte").
        : planEdgeSegments(dist2(A, B), wingBoundariesMm, maxSpan),
    )
  }

  // Vertices that must NOT receive a corner post: endpoint of ANY wall edge.
  // Rule (per-vertex, not per-edge-pair): a vertex is skipped iff it is an
  // endpoint of at least one wall edge — even if the OTHER edge meeting at
  // that vertex is free-standing. The wall bracket runs the full length of
  // its edge including the corner; a post there would fight the bracket.
  // With a single wall edge this reduces to the original behaviour (both of
  // that edge's endpoints skipped) — verified unchanged by frame.test.ts.
  // Computed here (not just before the posts loop below) because the
  // вистур beam segmentation also needs to know whether a real post sits
  // at a given corner.
  const wallVertices = new Set<number>()
  for (const idx of wallEdgeIndices) {
    wallVertices.add(idx)
    wallVertices.add((idx + 1) % n)
  }

  const visturBeamReductionMm = spec.visturTolerances?.beamSegmentReductionMm ?? 0
  const segmentBeams = spec.visturTolerances != null && supportType !== 'hanging'

  // ── Beams ──────────────────────────────────────────────────────────────────

  const beams: CutPiece[] = []
  let beamId = 0

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const A = pts[i]
    const B = pts[j]

    const isWallEdge = wallEdgeIndices.has(i)

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
    const dir: Vector2D = edgeLen > 1e-9 ? [edgeVec[0] / edgeLen, edgeVec[1] / edgeLen] : [1, 0]

    const mS = miters[i]
    const mE = miters[j]

    const cms = Math.abs(mS.miterAngleDeg)
    const cme = Math.abs(mE.miterAngleDeg)

    // cutHandStart: the beam OUTGOES from vertex i → use cutHandOutgoing
    // cutHandEnd:   the beam ARRIVES at vertex j → use cutHandIncoming
    const chs = mS.cutHandOutgoing
    const che = mE.cutHandIncoming

    if (!segmentBeams) {
      // Legacy / non-вистур path — exactly the pre-existing single
      // whole-edge beam, byte-for-byte, regardless of intermediate posts.
      const δStart = miterOffset(cms, profile.widthMm)
      const δEnd   = miterOffset(cme, profile.widthMm)

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
      continue
    }

    // Вистур path — split into one welded segment per bay. A bay MUST break
    // at every shape wing boundary (a real construction joint regardless of
    // maxSpanMm — see planEdgeSegments) AND at every maxSpanMm point the
    // intermediate-post loop below will ALSO place a post at, from the
    // exact same plan — so a segment boundary always lines up with a real
    // post, by construction (one shared plan), not by convention.
    const { wingBoundariesMm, intraWingSpanPointsMm } = edgeSegmentPlans[i]
    const boundariesMm = [0, ...[...wingBoundariesMm, ...intraWingSpanPointsMm].sort((a, b) => a - b), edgeLen]

    const startHasPost = !wallVertices.has(i)
    const endHasPost = !wallVertices.has(j)

    for (let seg = 0; seg + 1 < boundariesMm.length; seg++) {
      const isFirstSeg = seg === 0
      const isLastSeg = seg === boundariesMm.length - 2

      const segStartMm = boundariesMm[seg]
      const segEndMm = boundariesMm[seg + 1]
      const rawSegLenMm = segEndMm - segStartMm

      // Every INTERNAL boundary is a real post (guaranteed by construction
      // via intermediatePostTs) → always retract. An OUTER boundary only
      // retracts if a post is actually there (see startHasPost/endHasPost
      // — a wall vertex has a bracket instead, nothing to weld a gap for).
      const retractStart = isFirstSeg ? (startHasPost ? visturBeamReductionMm / 2 : 0) : visturBeamReductionMm / 2
      const retractEnd = isLastSeg ? (endHasPost ? visturBeamReductionMm / 2 : 0) : visturBeamReductionMm / 2

      const segLenMm = rawSegLenMm - retractStart - retractEnd
      if (segLenMm < MIN_SEGMENT_MM) continue

      // Real corner miter only survives at an outer end that is genuinely
      // the frame's own outer perimeter corner; every post-crossing end
      // (internal, or an outer end with no post to weld against isn't
      // relevant here since it keeps the real corner cut too) is straight.
      const segCms = isFirstSeg ? cms : 0
      const segCme = isLastSeg ? cme : 0
      const segChs = isFirstSeg ? chs : 'straight' as const
      const segChe = isLastSeg ? che : 'straight' as const

      const δStart = miterOffset(segCms, profile.widthMm)
      const δEnd   = miterOffset(segCme, profile.widthMm)

      const startDistMm = segStartMm + retractStart
      const startPos: Point2D = [
        A[0] + startDistMm * dir[0],
        A[1] + startDistMm * dir[1],
      ]

      beams.push({
        id:       `beam-${beamId++}`,
        role:     'beam',
        profileId,

        lengthAxisMm:  segLenMm,
        lengthLongMm:  segLenMm + δStart + δEnd,
        lengthShortMm: segLenMm - δStart - δEnd,

        cutMiterStartDeg: segCms,
        cutBevelStartDeg: 0,
        cutHandStart:     segChs,

        cutMiterEndDeg: segCme,
        cutBevelEndDeg: 0,
        cutHandEnd:     segChe,

        position: [startPos[0], spec.heightMm, startPos[1]],
        rotation: [0, -θ, 0],
        color: spec.color,
      })
    }
  }

  // ── Posts ──────────────────────────────────────────────────────────────────

  const posts: CutPiece[] = []

  if (supportType === 'hanging') {
    return { beams, posts, isOrthogonal }
  }

  let postId = 0

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

  // Intermediate posts along each edge, computed WITHIN each shape wing
  // separately (see edgeSegmentPlans above) — same plan the вистур beam
  // segmentation above reads, so the two can never disagree on where a
  // maxSpanMm post belongs. The wing boundary itself is deliberately NOT
  // posted here — see prompt "лишним оказывается maxSpanMm-стойка, а не
  // стойка на границе крыла": that post remains segmentBeamsForStock's own
  // job downstream, unchanged.
  for (let i = 0; i < n; i++) {
    const A = pts[i]
    const B = pts[(i + 1) % n]
    const edgeLen = dist2(A, B)
    for (const distMm of edgeSegmentPlans[i].intraWingSpanPointsMm) {
      const t = distMm / edgeLen
      const pos: Point2D = [
        A[0] + t * (B[0] - A[0]),
        A[1] + t * (B[1] - A[1]),
      ]
      posts.push(makePost(pos))
    }
  }

  return { beams, posts, isOrthogonal }
}
