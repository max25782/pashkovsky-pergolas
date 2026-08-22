import type { CutPiece, PergolaSpec, Point2D, ProfileDimensions } from './types'
import type { FrameResult } from './frame'
import { pieceAxis } from './pieceAxis'
import { longPointOffset } from './lamellas'
import { effectiveKerfMm } from './packProfile'
import { decomposeIntoRectangles, findWingBoundariesAlongSegment, type Rectangle } from './rectangleDecomposition'

/** Tolerance for "is this point on the beam's line" / "is this length effectively at the limit", mm. */
const EPS_MM = 1
/** Segments shorter than this are discarded as degenerate — same threshold used elsewhere in pergola-core. */
const MIN_SEGMENT_MM = 1.0

/**
 * Default max distance a fresh splice may be re-targeted (snapped) onto an
 * existing structural post instead of planting a brand-new one nearby — see
 * prompt "стык балки притягивается к существующей стойке (не плодит вторую
 * рядом)". Deliberately much larger than the concrete defect that motivated
 * this (~423mm, two posts ~42cm apart): per the prompt's own guidance ("если
 * две стойки ближе ~50-80 см, это почти всегда должна быть одна"), the
 * threshold has to comfortably clear that whole range, not just the one
 * observed case. Exposed as `segmentBeamsForStock`'s own parameter (see
 * prompt "параметр, не константа") — this is only the shared default.
 */
export const DEFAULT_SNAP_TOLERANCE_MM = 800

/**
 * A perimeter beam (or purlin) is too long for ANY available stock length,
 * even after using every existing structural joint AND adding new posts
 * everywhere the uniform fallback would put them. This is a real design
 * error (see prompt "узлов не хватило") — surfaced to the caller instead of
 * silently packing a piece the saw can never actually cut from stock.
 *
 * In practice this should be rare (the uniform fallback below can always
 * insert enough new posts to shrink a segment under maxStockMm), but a
 * profile with widthMm large enough that longPointOffset alone exceeds
 * maxStockMm at a very sharp corner, or a beam with no `postProfileId`
 * available (supportType: 'hanging'), can legitimately hit this.
 */
export interface BeamSegmentationIssue {
  code: 'beam-exceeds-stock-no-joint'
  message: string
  pieceId: string
  profileId: string
  lengthLongMm: number
  maxStockMm: number
}

export interface SegmentBeamsForStockResult {
  beams: CutPiece[]
  posts: CutPiece[]
  issues: BeamSegmentationIssue[]
}

function dist2(a: Point2D, b: Point2D): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Structural wing boundaries imposed by the contour's shape, for one already
 * -built beam `CutPiece` — see prompt "разложение формы на прямоугольники
 * ПЕРЕД сегментацией балок". Thin wrapper: the actual reach-depth logic
 * lives in `rectangleDecomposition.ts`'s `findWingBoundariesAlongSegment`,
 * shared verbatim with `frame.ts`'s own edge-segmentation (per RAW contour
 * edge, before any beam/post exists — see prompt "не по уговору в
 * комментарии, а по конструкции") so the two can never derive a different
 * boundary for the same physical wall. See that function's own docstring
 * for the `rectangles === null` (non-orthogonal contour) fallback.
 */
export function findRectangleWingBoundaries(beam: CutPiece, rectangles: Rectangle[] | null): number[] {
  const { start, end } = pieceAxis(beam)
  return findWingBoundariesAlongSegment(start, end, rectangles)
}

/**
 * Project `point` onto the infinite line through (beamStart, beamDir).
 * Returns the signed distance along `beamDir` from beamStart iff `point`
 * lies within EPS_MM of that line (perpendicular distance), else null — a
 * point that merely happens to be nearby but off-axis is NOT a valid splice
 * candidate (nothing to weld the two ends to without a real coincidence).
 */
function projectOntoAxis(beamStart: Point2D, beamDir: Point2D, point: Point2D): number | null {
  const rel: Point2D = [point[0] - beamStart[0], point[1] - beamStart[1]]
  const along = rel[0] * beamDir[0] + rel[1] * beamDir[1]
  const perp = -rel[0] * beamDir[1] + rel[1] * beamDir[0]
  if (Math.abs(perp) > EPS_MM) return null
  return along
}

/**
 * One candidate splice point along a beam's own axis, with enough info to
 * decide whether a post must be added there. Exported (alongside
 * findJointCandidates/planBoundaries/segmentReserveMm below) so
 * ledPurlinReversal.ts's Rule B can reuse the EXACT same joint-priority and
 * kerf-aware capacity logic for an LED purlin's own span, instead of a
 * second, drifting copy — see prompt "Точка деления — по тем же правилам
 * узла, что A".
 */
export interface JointCandidate {
  distMm: number
  hasPost: boolean
}

/**
 * Find every existing structural connection point strictly INSIDE
 * (0, totalLenMm) of one beam's own run — see prompt "Приоритет выбора
 * точки стыка":
 *   • an existing post (corner or intermediate, from computeFrame's own
 *     maxSpanMm placement) that lies on this beam's line — splice there,
 *     no new post needed.
 *   • an existing PERPENDICULAR piece's endpoint (another beam segment, or
 *     a purlin — see prompt "поперечная балка / ступенька контура") that
 *     touches this beam's line but has no post there yet — still a real
 *     joint (something to butt the two ends against), but the splice still
 *     needs a post added under it (a horizontal splice must be SUPPORTED,
 *     not just abutted — see prompt "стык должен опираться").
 * De-duplicates points within EPS_MM of each other, preferring the
 * `hasPost: true` variant when both a post and a crossing piece coincide at
 * (near enough to) the same point.
 */
export function findJointCandidates(
  beam: CutPiece,
  beamStart: Point2D,
  beamDir: Point2D,
  totalLenMm: number,
  allPosts: CutPiece[],
  allOtherRunPieces: CutPiece[],
): JointCandidate[] {
  const candidates: JointCandidate[] = []

  function add(distMm: number, hasPost: boolean) {
    if (!(distMm > EPS_MM) || !(distMm < totalLenMm - EPS_MM)) return
    const existing = candidates.find((c) => Math.abs(c.distMm - distMm) <= EPS_MM)
    if (existing) {
      existing.hasPost = existing.hasPost || hasPost
      return
    }
    candidates.push({ distMm, hasPost })
  }

  for (const post of allPosts) {
    const [px, pz] = pieceAxis(post).start
    const d = projectOntoAxis(beamStart, beamDir, [px, pz])
    if (d != null) add(d, true)
  }

  for (const other of allOtherRunPieces) {
    if (other.id === beam.id) continue
    const { start, end } = pieceAxis(other)
    for (const pt of [start, end]) {
      const d = projectOntoAxis(beamStart, beamDir, pt)
      if (d != null) add(d, false)
    }
  }

  return candidates.sort((a, b) => a.distMm - b.distMm)
}

/**
 * Extra length (mm) a hypothetical segment with the given end conditions
 * must reserve BEYOND its own lengthAxisMm before it can be compared
 * against `maxStockMm` — see prompt "керф на стыке балки": every cut,
 * including a plain straight internal splice (NOT just the beam's own real
 * angled corners), removes kerf-width material, exactly as packProfile's
 * own pieceKerfMm charges it later at pack time. Getting this wrong
 * reproduces the purlin bug one level down: a segment sized to EXACTLY
 * maxStockMm still throws out of packProfile once its kerf is added
 * (see `packProfile: piece "…" needs …mm … but stock length is only …mm`).
 *
 *   reserve = δStart + δEnd + max(kerfStart, kerfEnd)
 *
 * δ is 0 at an end that is a NEW internal splice (straight cut, no length
 * offset) and the beam's own real longPointOffset at a true outer end;
 * kerf is charged once per piece (packProfile's own "max of both ends"
 * convention, not a sum) but a straight cut is NOT free — effectiveKerfMm
 * at miter=bevel=0 is still the full nominal kerfMm.
 */
export function segmentReserveMm(
  beam: CutPiece,
  profileWidthMm: number,
  kerfMm: number,
  hasRealStart: boolean,
  hasRealEnd: boolean,
): number {
  const cms = hasRealStart ? beam.cutMiterStartDeg : 0
  const cbs = hasRealStart ? beam.cutBevelStartDeg : 0
  const cme = hasRealEnd ? beam.cutMiterEndDeg : 0
  const cbe = hasRealEnd ? beam.cutBevelEndDeg : 0

  const deltaStart = hasRealStart ? longPointOffset(cms, profileWidthMm) : 0
  const deltaEnd = hasRealEnd ? longPointOffset(cme, profileWidthMm) : 0
  const kerfStart = effectiveKerfMm(kerfMm, cms, cbs)
  const kerfEnd = effectiveKerfMm(kerfMm, cme, cbe)

  return deltaStart + deltaEnd + Math.max(kerfStart, kerfEnd)
}

function makePost(spec: PergolaSpec, pos: Point2D, nextId: () => string): CutPiece {
  return {
    id: nextId(),
    role: 'post',
    profileId: spec.postProfileId,

    lengthAxisMm: spec.heightMm,
    lengthLongMm: spec.heightMm,
    lengthShortMm: spec.heightMm,

    cutMiterStartDeg: 0,
    cutBevelStartDeg: 0,
    cutHandStart: 'straight',

    cutMiterEndDeg: 0,
    cutBevelEndDeg: 0,
    cutHandEnd: 'straight',

    position: [pos[0], 0, pos[1]],
    rotation: [0, 0, 0],
    color: spec.color,
  }
}

/**
 * Split ONE beam's straight run into segments no longer than `capacityMm`
 * (the AXIS length budget already reduced by kerf/miter reserve — see
 * `segmentReserveMm`/the caller — so every resulting segment's real
 * lengthLongMm+kerf fits `maxStockMm`, not just its raw lengthAxisMm),
 * choosing splice points along it (see findJointCandidates priority above)
 * and, only when no existing joint reaches far enough, falling back to a
 * uniform division of the remaining stretch with a brand-new post at each
 * new internal boundary — same "ceil(len/maxSpan) equal spans" shape as
 * computeSpanDivisionPointsMm elsewhere in this package, so a beam that
 * needed 3 pieces gets 3 EQUAL pieces, not "2 max-length pieces + 1 short
 * remainder".
 *
 * GREEDY CHOICE — furthest reachable candidate wins, not the first/closest
 * one (see prompt "дальний-первый... а другой порядок"). This is not an
 * arbitrary heuristic: for "reach a fixed end point via hops of length
 * ≤ capacityMm, landing only on given candidate points, unlimited hops",
 * picking the furthest reachable point at every step is PROVABLY optimal
 * for feasibility, by a standard exchange argument — if some other choice
 * o ≤ g (g = greedy's furthest pick) is used instead, then o's own window
 * [o, o+capacityMm] is a SUBSET of g's window [g, g+capacityMm] (since
 * g ≥ o ⇒ g+capacityMm ≥ o+capacityMm), so anything reachable after
 * picking o remains reachable after picking g too. Greedy can therefore
 * never end up "worse off" than any alternative sequence of choices among
 * the SAME fixed candidate set — there is no ordering that reaches a point
 * greedy-furthest cannot also reach. (This is exactly why the fallback
 * below, which can always plant a brand-new post anywhere, never needs to
 * "un-pick" an earlier candidate — see segmentBeamsForStockTest
 * "не в порядке выбора кандидата" for the regression this reasoning is
 * checked against: furthest-first must produce the FEWEST pieces, proving
 * it isn't secretly falling back to first-found.)
 *
 * Ties (within EPS_MM of the furthest) prefer an existing post over a bare
 * crossing-piece endpoint (see JointCandidate.hasPost) since it needs no
 * new post.
 */
export function planBoundaries(
  totalLenMm: number,
  capacityMm: number,
  candidates: JointCandidate[],
  canAddNewPost: boolean,
): { boundaries: number[]; newPostDistances: number[] } | null {
  const boundaries: number[] = []
  const newPostDistances: number[] = []
  let cursor = 0

  while (totalLenMm - cursor > capacityMm + EPS_MM) {
    const windowEnd = cursor + capacityMm
    const usable = candidates.filter((c) => c.distMm > cursor + EPS_MM && c.distMm <= windowEnd + EPS_MM)

    if (usable.length > 0) {
      // Furthest reach wins (fewest pieces); prefer an existing post over a
      // bare crossing-piece point at (near enough to) the same distance.
      const furthestDist = usable[usable.length - 1].distMm
      const atFurthest = usable.filter((c) => Math.abs(c.distMm - furthestDist) <= EPS_MM)
      const chosen = atFurthest.find((c) => c.hasPost) ?? atFurthest[0]
      boundaries.push(chosen.distMm)
      if (!chosen.hasPost) newPostDistances.push(chosen.distMm)
      cursor = chosen.distMm
      continue
    }

    if (!canAddNewPost) return null

    const remainder = totalLenMm - cursor
    const nSpans = Math.ceil(remainder / capacityMm)
    const step = remainder / nSpans
    for (let k = 1; k < nSpans; k++) {
      const pt = cursor + k * step
      boundaries.push(pt)
      newPostDistances.push(pt)
    }
    cursor = totalLenMm
  }

  return { boundaries, newPostDistances }
}

/**
 * Re-target a FRESH splice (`chosenDistMm`, one of `planBoundaries`' own
 * `newPostDistances`, in the SAME wing-local coordinates as `candidates`)
 * onto a nearby EXISTING post instead, when doing so is both close enough
 * and safe — see prompt "стык балки притягивается к существующей стойке":
 * two posts a few dozen cm apart (one brand-new, one already standing from
 * `computeFrame`'s own maxSpanMm placement) is a construction defect, not a
 * rendering nicety, and must never reach the drawing/order sheet.
 *
 * WHY THIS IS A SEPARATE PASS, NOT A planBoundaries CHANGE: planBoundaries'
 * own greedy window is deliberately capacity-EXACT and provably optimal for
 * reachability using one shared, conservative `capacityMm` per wing (see its
 * own docstring) — that reasoning is untouched here. But `capacityMm` is the
 * MAX of every window's possible end-condition reserve in the wing (start /
 * internal / end — see `segmentReserveMm` call sites above), so a window
 * whose OWN two real segments would actually need a SMALLER reserve (e.g.
 * the wing's first segment, whose far/internal end is cheap, while some
 * OTHER window elsewhere in the wing needs the expensive real-corner
 * reserve that set the shared max) can have genuine slack the coarse
 * capacity denied it. This function re-checks that slack PRECISELY, with
 * the exact `segmentReserveMm` for the two segments THIS specific snap
 * would produce — not a relaxation of the greedy proof, an independent,
 * stricter-where-it-matters safety check applied only after greedy has
 * already made its choice.
 *
 * Returns `chosenDistMm` UNCHANGED (refuses to snap) whenever:
 *   - no existing-post candidate lies within `snapToleranceMm`, or
 *   - the candidate is already at (near enough to) `chosenDistMm` — nothing
 *     to do, `planBoundaries` already landed on it, or
 *   - snapping would leave either resulting segment (`prevBoundaryMm` →
 *     candidate, or candidate → `nextBoundaryMm`) needing more than
 *     `maxStockMm` once ITS OWN real end-cut reserve is added — see prompt
 *     "сдвиг стыка не должен нарушить длину хлыста".
 *
 * @param hasRealStartAtPrev  Whether `prevBoundaryMm` is the wing's own true
 *   start (a real contour corner) — i.e. this is the wing's first segment —
 *   as opposed to an earlier internal splice. Mirrors `segmentBeamsForStock`
 *   own per-wing `hasRealStart`.
 * @param hasRealEndAtNext    Same, for whether `nextBoundaryMm` is the
 *   wing's own true end (this is the wing's last segment).
 */
export function snapBoundaryToExistingPost(
  chosenDistMm: number,
  prevBoundaryMm: number,
  nextBoundaryMm: number,
  hasRealStartAtPrev: boolean,
  hasRealEndAtNext: boolean,
  candidates: JointCandidate[],
  beam: CutPiece,
  profileWidthMm: number,
  kerfMm: number,
  maxStockMm: number,
  snapToleranceMm: number,
): number {
  let best: JointCandidate | null = null
  let bestGapMm = Infinity

  for (const candidate of candidates) {
    if (!candidate.hasPost) continue
    if (candidate.distMm <= prevBoundaryMm + EPS_MM || candidate.distMm >= nextBoundaryMm - EPS_MM) continue
    const gapMm = Math.abs(candidate.distMm - chosenDistMm)
    if (gapMm <= EPS_MM) return chosenDistMm // planBoundaries already chose this exact post.
    if (gapMm <= snapToleranceMm && gapMm < bestGapMm) {
      best = candidate
      bestGapMm = gapMm
    }
  }
  if (!best) return chosenDistMm

  const segBeforeLenMm = best.distMm - prevBoundaryMm
  const segAfterLenMm = nextBoundaryMm - best.distMm
  if (segBeforeLenMm < MIN_SEGMENT_MM || segAfterLenMm < MIN_SEGMENT_MM) return chosenDistMm

  const reserveBeforeMm = segmentReserveMm(beam, profileWidthMm, kerfMm, hasRealStartAtPrev, false)
  const reserveAfterMm = segmentReserveMm(beam, profileWidthMm, kerfMm, false, hasRealEndAtNext)

  if (segBeforeLenMm + reserveBeforeMm > maxStockMm + EPS_MM) return chosenDistMm
  if (segAfterLenMm + reserveAfterMm > maxStockMm + EPS_MM) return chosenDistMm

  return best.distMm
}

/**
 * Re-segment perimeter beams in two strictly ordered levels:
 *
 * 1. SHAPE: decompose the whole contour into rectangles (see
 *    `decomposeIntoRectangles`) and split each beam wherever the reach-depth
 *    into the polygon actually changes (see `findRectangleWingBoundaries`).
 *    Those points are mandatory wing boundaries even when both resulting
 *    wings fit one stock bar.
 * 2. STOCK: process each wing independently. A wing longer than its
 *    profile's longest availableStockLengthsMm is split using the existing
 *    structural-joint/post logic, with candidates constrained to that wing,
 *    then any fresh (brand-new-post) splice is re-checked against nearby
 *    EXISTING posts and snapped onto one when safe (see
 *    `snapBoundaryToExistingPost` / prompt "стык балки притягивается к
 *    существующей стойке") — otherwise two posts a few dozen cm apart (one
 *    real, one just invented) would stand where one already does the job.
 *
 * The stock layer can never move, skip, or cross a shape boundary. Packing
 * remains downstream and is never allowed to choose construction joints.
 *
 * Reads (does not recompute) frame.posts — the post grid from
 * computeFrame's own maxSpanMm placement is the single source of truth for
 * "where does a post already stand"; this function only ADDS a post when
 * every existing joint (post or crossing piece) is out of reach.
 *
 * TWO BEAMS SHARING A CORNER (see prompt "на реальной большой пергале
 * углы поедут"): two adjacent perimeter beams always share their corner
 * as a fixed endpoint (distMm≈0 or ≈totalLenMm on EACH beam's own axis),
 * never as an internal splice candidate — findJointCandidates only
 * returns points strictly inside (0, totalLenMm) — so segmenting one
 * beam can never touch, duplicate, or shift the corner post/miter its
 * neighbour also relies on; each beam's own new post lands strictly
 * inside its own span, verified in beamSegmentation.test.ts. computeFrame
 * currently emits one beam per polygon edge only (no internal cross-beams
 * — see frame.ts), so two DIFFERENT beams cannot yet claim the exact same
 * mid-span splice point at all; that scenario (a real T-junction) is
 * flagged `it.todo` in the test file for when cross-beams exist.
 *
 * Profiles with no availableStockLengthsMm still receive mandatory shape
 * boundaries, but skip level-2 stock segmentation (honest gap — without
 * catalog data we cannot tell whether a wing is too long).
 *
 * @param spec     The same PergolaSpec used to build `frame` — needed for
 *                    postProfileId/heightMm/color when a new post is added,
 *                    and supportType (a 'hanging' pergola has no posts to
 *                    fall back on — see Rule A tier 3 vs `canAddNewPost`).
 * @param frame    computeFrame's own output (beams + posts) for this spec —
 *                    NOT recomputed here.
 * @param crossingPieces  Other already-computed pieces whose endpoints may
 *                    land on a beam's line and act as a tier-1 joint (e.g.
 *                    computePurlins' output). Purely additive information —
 *                    [] is always safe (falls back to posts-only, tier 2/3).
 * @param kerfMm      Saw kerf, mm — same meaning/default as packProfile's
 *                    own `kerfMm` (see DEFAULT_KERF_MM). MUST match the kerf
 *                    the order sheet will actually pack with, or a segment
 *                    sized right up against maxStockMm here can still throw
 *                    out of packProfile later (see prompt "керф на стыке
 *                    балки" / segmentReserveMm above).
 * @param snapToleranceMm  See `DEFAULT_SNAP_TOLERANCE_MM` / prompt "стык
 *                    балки притягивается к существующей стойке": a fresh
 *                    splice this far or closer from an existing post is
 *                    re-targeted onto it (when safe — see
 *                    `snapBoundaryToExistingPost`) instead of planting a
 *                    second post nearby.
 */
export function segmentBeamsForStock(
  spec: PergolaSpec,
  frame: FrameResult,
  crossingPieces: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
  kerfMm = 0,
  snapToleranceMm = DEFAULT_SNAP_TOLERANCE_MM,
): SegmentBeamsForStockResult {
  const canAddNewPost = (spec.supportType ?? 'posts') !== 'hanging'

  const outputBeams: CutPiece[] = []
  const outputPosts: CutPiece[] = [...frame.posts]
  const issues: BeamSegmentationIssue[] = []
  let newPostSeq = 0
  const nextPostId = () => `post-seg-${newPostSeq++}`

  // Computed once for the whole contour (not per beam) — null for a
  // non-orthogonal contour, in which case every beam's shapeBoundaries below
  // is simply [] and only Level-2 (stock/joint) segmentation runs, exactly
  // as it did before shape-wing splitting existed.
  const rectangles = decomposeIntoRectangles(spec.contour)

  // A later beam can use an EARLIER beam's already-placed new post as its
  // own candidate too (e.g. two collinear beams sharing a line) — grown as
  // we go, starting from the real post grid.
  const crossingPool = [...frame.beams, ...crossingPieces]

  for (const beam of frame.beams) {
    const profile = profiles.get(beam.profileId)
    const stockLengths = profile?.availableStockLengthsMm
    const maxStockMm = stockLengths && stockLengths.length > 0 ? Math.max(...stockLengths) : undefined
    const { start, end } = pieceAxis(beam)
    const totalLenMm = beam.lengthAxisMm
    const dir: Point2D = [(end[0] - start[0]) / totalLenMm, (end[1] - start[1]) / totalLenMm]
    const shapeBoundaries = findRectangleWingBoundaries(beam, rectangles)
    const wingBoundaries = [0, ...shapeBoundaries, totalLenMm]
    const allCandidates = findJointCandidates(beam, start, dir, totalLenMm, outputPosts, crossingPool)
    const stockBoundaries: number[] = []
    const newPostDistances: number[] = [...shapeBoundaries]
    let hasUnresolvableWing = false

    for (let wingIndex = 0; wingIndex + 1 < wingBoundaries.length; wingIndex++) {
      const wingStartMm = wingBoundaries[wingIndex]
      const wingEndMm = wingBoundaries[wingIndex + 1]
      const wingLenMm = wingEndMm - wingStartMm
      const hasRealStart = wingIndex === 0
      const hasRealEnd = wingIndex === wingBoundaries.length - 2

      if (maxStockMm == null) continue

      const wingReserveMm = segmentReserveMm(
        beam,
        profile!.widthMm,
        kerfMm,
        hasRealStart,
        hasRealEnd,
      )
      if (wingLenMm + wingReserveMm <= maxStockMm + EPS_MM) continue

      // Conservative single capacity used for every stock window inside
      // this wing. Shape boundaries are immutable: candidates are filtered
      // to the wing and remapped to its local 0..wingLen coordinate.
      const reserveFirstMm = segmentReserveMm(beam, profile!.widthMm, kerfMm, hasRealStart, false)
      const reserveInternalMm = segmentReserveMm(beam, profile!.widthMm, kerfMm, false, false)
      const reserveLastMm = segmentReserveMm(beam, profile!.widthMm, kerfMm, false, hasRealEnd)
      const capacityMm = maxStockMm - Math.max(reserveFirstMm, reserveInternalMm, reserveLastMm)

      if (capacityMm <= MIN_SEGMENT_MM) {
        issues.push({
          code: 'beam-exceeds-stock-no-joint',
          message:
            `Beam "${beam.id}" wing ${wingIndex + 1} (profile "${beam.profileId}") cannot be spliced: its ` +
            `end-cut geometry (miter offset + kerf) consumes ${(maxStockMm - capacityMm).toFixed(1)}mm of ` +
            `the ${maxStockMm}mm stock. Needs a longer stock length upstream, not a splice.`,
          pieceId: beam.id,
          profileId: beam.profileId,
          lengthLongMm: beam.lengthLongMm,
          maxStockMm,
        })
        hasUnresolvableWing = true
        break
      }

      const wingCandidates = allCandidates
        .filter((candidate) =>
          candidate.distMm > wingStartMm + EPS_MM &&
          candidate.distMm < wingEndMm - EPS_MM)
        .map((candidate) => ({
          distMm: candidate.distMm - wingStartMm,
          hasPost: candidate.hasPost,
        }))
      const wingPlan = planBoundaries(wingLenMm, capacityMm, wingCandidates, canAddNewPost)

      if (!wingPlan) {
        issues.push({
          code: 'beam-exceeds-stock-no-joint',
          message:
            `Beam "${beam.id}" wing ${wingIndex + 1} (profile "${beam.profileId}") is longer than the ` +
            `longest available stock (${maxStockMm}mm), and no joint or new post is available inside this ` +
            `wing (supportType "${spec.supportType ?? 'posts'}"). Shape-wing boundaries cannot be crossed.`,
          pieceId: beam.id,
          profileId: beam.profileId,
          lengthLongMm: beam.lengthLongMm,
          maxStockMm,
        })
        hasUnresolvableWing = true
        break
      }

      // Snap-to-existing-post refinement (see snapBoundaryToExistingPost's
      // own docstring for why this is safe/necessary on top of the greedy
      // choice above): only touches boundaries planBoundaries itself marked
      // as needing a BRAND-NEW post; existing-post boundaries it already
      // picked are left exactly as chosen.
      const newPostSet = new Set(wingPlan.newPostDistances)
      const snappedBoundaries = wingPlan.boundaries.map((distanceMm, index) => {
        if (!newPostSet.has(distanceMm)) return distanceMm
        const prevMm = index === 0 ? 0 : wingPlan.boundaries[index - 1]
        const nextMm = index + 1 < wingPlan.boundaries.length ? wingPlan.boundaries[index + 1] : wingLenMm
        const snappedMm = snapBoundaryToExistingPost(
          distanceMm,
          prevMm,
          nextMm,
          index === 0 && hasRealStart,
          index === wingPlan.boundaries.length - 1 && hasRealEnd,
          wingCandidates,
          beam,
          profile!.widthMm,
          kerfMm,
          maxStockMm,
          snapToleranceMm,
        )
        if (Math.abs(snappedMm - distanceMm) > EPS_MM) newPostSet.delete(distanceMm)
        return snappedMm
      })

      stockBoundaries.push(...snappedBoundaries.map((distanceMm) => wingStartMm + distanceMm))
      newPostDistances.push(...[...newPostSet].map((distanceMm) => wingStartMm + distanceMm))
    }

    if (hasUnresolvableWing) {
      outputBeams.push(beam)
      continue
    }

    const cutPoints = [...shapeBoundaries, ...stockBoundaries]
      .sort((a, b) => a - b)
      .filter((distanceMm, index, sorted) =>
        index === 0 || Math.abs(distanceMm - sorted[index - 1]) > EPS_MM)

    if (cutPoints.length === 0) {
      outputBeams.push(beam)
      continue
    }

    const boundaries = [0, ...cutPoints, totalLenMm]

    let segIdx = 0
    for (let seg = 0; seg + 1 < boundaries.length; seg++) {
      const isFirst = seg === 0
      const isLast = seg === boundaries.length - 2
      const segStartMm = boundaries[seg]
      const segEndMm = boundaries[seg + 1]
      const segLenMm = segEndMm - segStartMm
      if (segLenMm < MIN_SEGMENT_MM) continue

      const segCms = isFirst ? beam.cutMiterStartDeg : 0
      const segChs = isFirst ? beam.cutHandStart : ('straight' as const)
      const segCme = isLast ? beam.cutMiterEndDeg : 0
      const segChe = isLast ? beam.cutHandEnd : ('straight' as const)
      const segCbs = isFirst ? beam.cutBevelStartDeg : 0
      const segCbe = isLast ? beam.cutBevelEndDeg : 0

      const δStart = longPointOffset(segCms, profile!.widthMm)
      const δEnd = longPointOffset(segCme, profile!.widthMm)

      const segStartPt: Point2D = [start[0] + segStartMm * dir[0], start[1] + segStartMm * dir[1]]

      outputBeams.push({
        ...beam,
        id: `${beam.id}-seg${segIdx++}`,

        lengthAxisMm: segLenMm,
        lengthLongMm: segLenMm + δStart + δEnd,
        lengthShortMm: segLenMm - δStart - δEnd,

        cutMiterStartDeg: segCms,
        cutBevelStartDeg: segCbs,
        cutHandStart: segChs,

        cutMiterEndDeg: segCme,
        cutBevelEndDeg: segCbe,
        cutHandEnd: segChe,

        position: [segStartPt[0], beam.position[1], segStartPt[1]],
      })
    }

    for (const distMm of newPostDistances) {
      if (!canAddNewPost) continue
      const pos: Point2D = [start[0] + distMm * dir[0], start[1] + distMm * dir[1]]
      // Guard against adding a duplicate at (near enough to) a spot another
      // beam's segmentation pass already planted a post at — collinear
      // beams sharing an endpoint region could otherwise double up.
      const already = outputPosts.some((p) => dist2(pieceAxis(p).start, pos) <= EPS_MM)
      if (already) continue
      outputPosts.push(makePost(spec, pos, nextPostId))
    }
  }

  return { beams: outputBeams, posts: outputPosts, issues }
}
