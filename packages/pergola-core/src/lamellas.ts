import type { Point2D, Vector2D, CutPiece, PergolaSpec, ProfileDimensions } from './types'
import { isCCW } from './miter'
import { computeSpanDivisionPointsMm } from './lamellaSpans'
import { resolveLamellaPattern, patternMaxLamellaSpanMm, type LamellaPatternEntry } from './lamellaPattern'
import { sanitizeContour } from './contourSanitize'

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

/** Cut data for one end of a lamella (sub-)piece — either the real contour cut or a straight purlin-crossing cut. */
interface EndCut {
  cutMiterDeg: number
  cutHand: 'L' | 'R' | 'straight'
}

const STRAIGHT_END_CUT: EndCut = { cutMiterDeg: 0, cutHand: 'straight' }

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
 * PITCH (fixed bug — see prompt "ламели рендерятся сплошной плитой"):
 *   For a single-profile (homogeneous) layout, pitch = visibleWidthMm +
 *   spec.lamellaGapMm. The old code used lamellaGapMm directly as the
 *   pitch, ignoring the profile's own width — any profile wider than the
 *   configured "gap" produced heavily overlapping pieces that visually
 *   merged into a solid slab. First scan line starts at tMin +
 *   visibleWidthMm/2 (its near edge flush with the contour), not tMin +
 *   gapMm/2 (which let the first/last lamella overhang past the contour
 *   edge whenever gapMm < visibleWidthMm).
 *
 * MIXED-WIDTH PATTERN (spec.lamellaPattern — see prompt "смешанные ламели"):
 *   The homogeneous case above is really just a pattern of length 1 — there
 *   is only one code path (see resolveLamellaPattern in lamellaPattern.ts).
 *   With N profiles cycling, the pitch between adjacent rows is NOT
 *   constant: it depends on BOTH rows' visible widths,
 *     spacing(i→i+1) = visibleWidth(i)/2 + lamellaGapMm + visibleWidth(i+1)/2
 *   so a 70→40→20→70… cycle at gap=20 gives spacings 75, 50, 65, 75, 50,
 *   65… (not a single number). The scan advances row-by-row (not by a fixed
 *   pitch) starting at tMin + visibleWidth(pattern[0])/2, wrapping the
 *   pattern index with modulo once it reaches the end.
 *
 * VISIBLE WIDTH (spec.lamellaOnEdge — a CORE parameter, not a render flag):
 *   By default (lamellaOnEdge falsy) the lamella lies flat: profile.widthMm
 *   is the horizontal face seen from below (the "40/gap/40/gap..." pattern),
 *   profile.heightMm is the vertical thickness. lamellaOnEdge=true rotates
 *   the cross-section 90° about the lamella's own length axis — the
 *   profile's heightMm becomes the visible (horizontal, pitch-driving) width
 *   and widthMm becomes vertical. This changes the SCAN PITCH, hence the
 *   piece count and the cut list — it must trigger a full recompute, exactly
 *   like changing the profile or the gap does. See lamellaOnEdge tests.
 *   Applies uniformly to every profile in the pattern.
 *
 * SEGMENTATION (spec.purlinProfileId → interruptsLamella === true):
 *   A purlin that physically interrupts the lamella run cuts it into one
 *   piece per span between purlins, each inner end straight (miter=0), the
 *   outer ends keeping the real contour cut. Division points come from
 *   computeSpanDivisionPointsMm — the SAME points computePurlins uses to
 *   place the purlins themselves, so a segment boundary always lines up
 *   with an actual purlin, never a "phantom" cut. The span limit used is
 *   patternMaxLamellaSpanMm — the SMALLEST maxLamellaSpanMm among all
 *   profiles in the pattern (the thinnest slat governs), so computePurlins
 *   (which resolves the same pattern) always agrees on the same crossings
 *   regardless of which row a given purlin happens to fall under.
 *   interruptsLamella=false (or no purlinProfileId / no profile in the
 *   pattern defines maxLamellaSpanMm) keeps the pre-existing behaviour: one
 *   continuous piece per scan-line segment.
 *
 * VISTUR ASSEMBLY CLEARANCE (spec.visturTolerances — see visturTolerances.ts
 * and prompt "рама-вистур"): undefined ⇒ no change, every length below is
 * exactly the raw scan-clip span, same as always. When set, each segment's
 * end(s) that meet the FRAME'S OWN outer perimeter beam (isFirstSeg /
 * isLastSeg below — i.e. a real contour cut, not a straight internal
 * purlin-crossing cut) are retracted lamellaLengthReductionMm / 2 mm before
 * lengthAxisMm/lengthLongMm/lengthShortMm and the piece's own start
 * position are computed from them. An internal purlin-crossing segment
 * boundary is NEVER retracted — that joint sits inside the same welded
 * frame, not at its outer edge, so it needs no factory-assembly clearance.
 * A single-segment row (no purlin interruption) therefore loses the FULL
 * lamellaLengthReductionMm (both ends real); a 3-segment interrupted row
 * loses lamellaLengthReductionMm/2 at each of its two OUTER segments only,
 * its middle segment(s) unchanged — the total material removed across one
 * full row is always exactly lamellaLengthReductionMm, regardless of how
 * many purlins cut it up.
 *
 * @param spec      PergolaSpec; contour auto-normalised to CCW winding.
 * @param profiles  Map from profileId → ProfileDimensions.
 *                  Must contain every profile id in spec.lamellaPattern (or
 *                  spec.lamellaProfileId when lamellaPattern is unset).
 */
export function computeLamellas(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): CutPiece[] {
  const {
    contour, lamellaDirectionDeg, lamellaGapMm,
    lamellaAngleDeg, heightMm, color, purlinProfileId,
    lamellaOnEdge,
  } = spec

  // See PergolaSpec.lamellaPattern / MIXED-WIDTH PATTERN above — the
  // homogeneous case (no lamellaPattern set) is a pattern of length 1
  // resolved through the exact same call, not a separate branch.
  const pattern = resolveLamellaPattern(spec, profiles)

  const effectiveTiltDeg = lamellaOnEdge ? lamellaAngleDeg + 90 : lamellaAngleDeg

  // Same entry-point sanitisation as computeFrame (see contourSanitize.ts) —
  // computeLamellas is called independently of computeFrame (both read
  // spec.contour directly, see e.g. apps/crm's plan-editor debug page), so
  // it needs its own defence against a raw, editor-drawn contour.
  const cleanContour = sanitizeContour(contour)
  const pts: Point2D[] = isCCW(cleanContour) ? cleanContour : [...cleanContour].reverse()

  const θ    = lamellaDirectionDeg * RAD
  const dir: Vector2D  = [Math.cos(θ), Math.sin(θ)]
  const perp: Vector2D = [-Math.sin(θ), Math.cos(θ)]

  const projections = pts.map(p => dot2(p, perp))
  const tMin = Math.min(...projections)
  const tMax = Math.max(...projections)

  // Global purlin crossing points, in the same absolute along-`dir` frame as
  // ScanHit.s below — undefined purlinProfileId / no interruptsLamella / no
  // profile in the pattern defining maxLamellaSpanMm ⇒ [] ⇒ every row stays
  // one piece (pre-existing behaviour, exercised by all the older fixtures).
  const purlinProfile = purlinProfileId ? profiles.get(purlinProfileId) : undefined
  const divisionPointsMm =
    purlinProfile?.interruptsLamella === true
      ? computeSpanDivisionPointsMm(
          Math.min(...pts.map(p => dot2(p, dir))),
          Math.max(...pts.map(p => dot2(p, dir))),
          patternMaxLamellaSpanMm(pattern),
        )
      : []

  // Row-by-row scan positions: NOT a fixed pitch — see MIXED-WIDTH PATTERN
  // above. `entry` is the pattern slot for THIS row; spacing to the NEXT
  // row depends on both this row's and the next row's visible width.
  const rows: Array<{ scanT: number; entry: LamellaPatternEntry }> = []
  {
    let scanT = tMin + pattern[0].visibleWidthMm * 0.5
    let i = 0
    while (scanT < tMax) {
      const entry = pattern[i % pattern.length]
      rows.push({ scanT, entry })
      const next = pattern[(i + 1) % pattern.length]
      scanT += entry.visibleWidthMm * 0.5 + lamellaGapMm + next.visibleWidthMm * 0.5
      i++
    }
  }

  // undefined ⇒ 0 (standard on-site assembly, no retraction at all) — see
  // VISTUR ASSEMBLY CLEARANCE above.
  const lengthReductionMm = spec.visturTolerances?.lamellaLengthReductionMm ?? 0
  const endRetractMm = lengthReductionMm / 2

  const pieces: CutPiece[] = []
  let id = 0

  for (const { scanT, entry } of rows) {
    const { profileId: lamellaProfileId, visibleWidthMm } = entry
    const anchor: Point2D = [perp[0] * scanT, perp[1] * scanT]
    const hits = scanLineClip(dir, perp, scanT, anchor, pts)

    for (let k = 0; k + 1 < hits.length; k += 2) {
      const h0 = hits[k]
      const h1 = hits[k + 1]
      if (h1.s - h0.s < MIN_SEGMENT_MM) continue

      const rowCrossings = divisionPointsMm.filter(t => t > h0.s + MIN_SEGMENT_MM && t < h1.s - MIN_SEGMENT_MM)
      const boundsS = [h0.s, ...rowCrossings, h1.s]

      const startCut: EndCut = cutAtEdge(dir, pts, h0.edgeIndex)
      const endCut: EndCut = cutAtEdge(dir, pts, h1.edgeIndex)

      for (let seg = 0; seg + 1 < boundsS.length; seg++) {
        const isFirstSeg = seg === 0
        const isLastSeg = seg === boundsS.length - 2

        // Retract ONLY the end(s) that are a real contour cut (the frame's
        // OWN outer perimeter beam) — an internal purlin-crossing straight
        // cut (neither isFirstSeg nor isLastSeg boundary) is left exactly
        // where the purlin division point says, see VISTUR ASSEMBLY
        // CLEARANCE above.
        const sStart = boundsS[seg] + (isFirstSeg ? endRetractMm : 0)
        const sEnd = boundsS[seg + 1] - (isLastSeg ? endRetractMm : 0)
        const lengthAxisMm = sEnd - sStart
        if (lengthAxisMm < MIN_SEGMENT_MM) continue

        const cutStart: EndCut = isFirstSeg ? startCut : STRAIGHT_END_CUT
        const cutEnd: EndCut = isLastSeg ? endCut : STRAIGHT_END_CUT

        const startPt: Point2D = [
          anchor[0] + sStart * dir[0],
          anchor[1] + sStart * dir[1],
        ]

        // The bevel is always the lamella's effective tilt (open/close angle,
        // plus the +90° from lamellaOnEdge if set), regardless of which edge
        const cbs = effectiveTiltDeg
        const cbe = effectiveTiltDeg

        // Three lengths: only the miter contributes to the length axis
        // measurement, using the VISIBLE (in-plan) width — see lamellaOnEdge.
        const δStart = longPointOffset(cutStart.cutMiterDeg, visibleWidthMm)
        const δEnd   = longPointOffset(cutEnd.cutMiterDeg, visibleWidthMm)
        const lengthLongMm  = lengthAxisMm + δStart + δEnd
        const lengthShortMm = lengthAxisMm - δStart - δEnd

        pieces.push({
          id:       `lamella-${id++}`,
          role:     'lamella',
          profileId: lamellaProfileId,

          lengthAxisMm,
          lengthLongMm,
          lengthShortMm,

          cutMiterStartDeg: cutStart.cutMiterDeg,
          cutBevelStartDeg: cbs,
          cutHandStart:     cutStart.cutHand,

          cutMiterEndDeg: cutEnd.cutMiterDeg,
          cutBevelEndDeg: cbe,
          cutHandEnd:     cutEnd.cutHand,

          // plan (x, y) → world (x, heightMm, y);  Y is up in Three.js
          position: [startPt[0], heightMm, startPt[1]],
          // rotation[0]: effective tilt (lamellaAngleDeg, +90° if onEdge);
          // rotation[1]: azimuth (−θ: Three.js +Y goes X→−Z)
          rotation: [effectiveTiltDeg * RAD, -θ, 0],
          color,
        })
      }
    }
  }

  return pieces
}
