import type { Point2D, Vector2D, CutPiece, PergolaSpec, ProfileDimensions } from './types'
import { isCCW } from './miter'
import { scanLineClip, cutAtEdge, longPointOffset } from './lamellas'
import { computeSpanDivisionPointsMm } from './lamellaSpans'
import { resolveLamellaPattern, patternMaxLamellaSpanMm, patternMaxVerticalThicknessMm } from './lamellaPattern'
import { computePurlins } from './purlins'
import { effectiveKerfMm } from './packProfile'
import { findJointCandidates, planBoundaries, segmentReserveMm } from './beamSegmentation'
import { sanitizeContour } from './contourSanitize'

const RAD = Math.PI / 180
const HALF_PI = Math.PI / 2

function dot2(a: Vector2D, b: Vector2D): number { return a[0] * b[0] + a[1] * b[1] }

/** Same tolerance/threshold family as beamSegmentation.ts and lamellas.ts. */
const EPS_MM = 1
const MIN_SEGMENT_MM = 1.0

/**
 * An LED purlin's own span (perpendicular to the lamellas) is longer than
 * every availableStockLengthsMm option AND Rule B's 90°-reversal sectioning
 * still couldn't find (or add) enough joints for the divider beam to make
 * every section fit — same real-construction-gap meaning as
 * BeamSegmentationIssue, kept as its own type because the piece/geometry
 * involved (an LED purlin span, not a perimeter beam) is different enough
 * that conflating the two `code` values would hide which rule actually
 * failed.
 */
export interface LedReversalIssue {
  code: 'led-purlin-exceeds-stock-no-joint'
  message: string
  profileId: string
  spanMm: number
  maxStockMm: number
}

export interface LedPurlinReversalResult {
  /** LED purlin pieces — the untouched sparse grid when reversal wasn't needed, or the dense per-section grid when it was. */
  purlins: CutPiece[]
  /** Non-LED divider beams Rule B introduced ([] when reversal wasn't needed). */
  dividers: CutPiece[]
  issues: LedReversalIssue[]
  /** True iff the 90° reversal actually triggered (false ⇒ `purlins` is exactly computePurlins' own output, `dividers` is []). */
  reversed: boolean
}

/**
 * Rule B (see prompt "ПРАВИЛО B — LED-БАЛКА"): an LED purlin can never be
 * spliced (two LED runs cannot be joined — the channel would show a seam),
 * so when its own span — the depth PERPENDICULAR to the lamellas, exactly
 * what computePurlins already computes as one crossing line's
 * `h1.s − h0.s` — exceeds every available stock length, the fix is NOT to
 * cut it (that's Rule A, for splice-able profiles). Instead:
 *
 *   1. A plain (non-LED) DIVIDER beam is placed ACROSS that span — running
 *      along the LAMELLA direction, at a chosen depth — splitting it into
 *      sections each ≤ stock. The divider's own placement follows the SAME
 *      joint priority as Rule A (existing node/post first, new divider only
 *      when nothing else reaches — see findJointCandidates/planBoundaries,
 *      reused verbatim from beamSegmentation.ts, not reimplemented).
 *   2. Within each section, LED purlins run PERPENDICULAR to the divider —
 *      i.e. the SAME direction they always ran in, just now short enough
 *      (bounded by the section's own depth, which is ≤ stock by
 *      construction) — but spaced along the lamella direction by
 *      `maxLedStepMm` (a lighting-density parameter) instead of the
 *      purely-structural `maxLamellaSpanMm`, since LED coverage may need to
 *      be denser than the structural purlin grid alone would place.
 *
 * Delegates entirely to computePurlins (byte-for-byte, `reversed: false`)
 * whenever reversal isn't needed: no purlinProfileId, the profile isn't
 * `hasLedChannel`, it has no availableStockLengthsMm to judge against, or
 * every sparse crossing already fits — zero behaviour change for every
 * pergola that doesn't hit this edge case (which, per the real catalog
 * data available today, is every pergola — see prompt "LED-прогон в
 * принципе не бывает длиннее хлыста").
 *
 * SIMPLIFICATION (documented, not silent): reversal is an all-or-nothing
 * decision for the WHOLE profile, sized against the single WIDEST sparse
 * crossing found (not decided independently per crossing line). For a
 * non-rectangular contour where the depth varies along the lamella
 * direction, this can section more conservatively than a per-column
 * decision would — but every emitted piece is still independently clipped
 * against the REAL contour via its own scanLineClip call, so this never
 * produces a geometrically wrong piece, only occasionally more sections
 * than the bare minimum for a narrower column.
 *
 * @param existingPosts   Real posts (e.g. frame.posts) the divider's own
 *                        placement may reuse as a tier-1/2 joint — [] is
 *                        always safe (falls back to a new-divider-only
 *                        split, tier 3).
 * @param crossingPieces  Other already-computed pieces (frame.beams, other
 *                        purlins) whose endpoints may land on the LED
 *                        purlin's own line and act as a joint too.
 * @param kerfMm          Saw kerf, mm — MUST match what the order sheet
 *                        will pack with (see DEFAULT_KERF_MM), same
 *                        reasoning as segmentBeamsForStock's own kerfMm.
 */
export function segmentLedPurlinsForStock(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  existingPosts: CutPiece[] = [],
  crossingPieces: CutPiece[] = [],
  kerfMm = 0,
): LedPurlinReversalResult {
  const { contour, lamellaDirectionDeg, heightMm, color, purlinProfileId } = spec

  if (!purlinProfileId) return { purlins: [], dividers: [], issues: [], reversed: false }

  const purlinProfile = profiles.get(purlinProfileId)
  if (!purlinProfile) {
    throw new Error(`Profile "${purlinProfileId}" not found in profiles map`)
  }

  const fallback = (): LedPurlinReversalResult => ({
    purlins: computePurlins(spec, profiles),
    dividers: [],
    issues: [],
    reversed: false,
  })

  // Only LED purlins can ever need a 90° reversal — a splice-able (non-LED)
  // profile that's too long is Rule A's job (segmentBeamsForStock), not
  // this function's.
  if (!purlinProfile.hasLedChannel) return fallback()

  const stockLengths = purlinProfile.availableStockLengthsMm
  const maxStockMm = stockLengths && stockLengths.length > 0 ? Math.max(...stockLengths) : undefined
  if (maxStockMm == null) return fallback() // honest gap — same "no real data, don't guess" rule as the rest of this package.

  const pattern = resolveLamellaPattern(spec, profiles)
  const maxLamellaSpanMm = patternMaxLamellaSpanMm(pattern)
  const baseYmm = purlinProfile.interruptsLamella === true
    ? heightMm
    : heightMm + patternMaxVerticalThicknessMm(pattern)

  // Same entry-point sanitisation as computeFrame/computeLamellas/computePurlins
  // (see contourSanitize.ts) — segmentLedPurlinsForStock is called independently
  // of all three.
  const cleanContour = sanitizeContour(contour)
  const pts: Point2D[] = isCCW(cleanContour) ? cleanContour : [...cleanContour].reverse()

  const θ = lamellaDirectionDeg * RAD
  const dir: Vector2D  = [Math.cos(θ), Math.sin(θ)]
  const perp: Vector2D = [-Math.sin(θ), Math.cos(θ)]

  const dirProjections = pts.map((p) => dot2(p, dir))
  const dirMin = Math.min(...dirProjections)
  const dirMax = Math.max(...dirProjections)

  const sparseTs = computeSpanDivisionPointsMm(dirMin, dirMax, maxLamellaSpanMm)
  if (sparseTs.length === 0) return fallback() // pergola fits one lamella span — computePurlins itself would emit nothing either.

  // ── Pass 1: does ANY sparse crossing actually exceed stock? Track the
  // WIDEST one as the representative span Rule B sections against (see
  // SIMPLIFICATION above).
  let anyTooLong = false
  let widestDepthMm = 0
  let widestH0S = 0
  let widestH0Edge = -1
  let widestH1Edge = -1
  let widestT = sparseTs[0]

  for (const t of sparseTs) {
    const anchor: Point2D = [dir[0] * t, dir[1] * t]
    const hits = scanLineClip(perp, dir, t, anchor, pts)
    for (let k = 0; k + 1 < hits.length; k += 2) {
      const h0 = hits[k]
      const h1 = hits[k + 1]
      const depthMm = h1.s - h0.s
      if (depthMm < MIN_SEGMENT_MM) continue

      const { cutMiterDeg: cms } = cutAtEdge(perp, pts, h0.edgeIndex)
      const { cutMiterDeg: cme } = cutAtEdge(perp, pts, h1.edgeIndex)
      const δStart = longPointOffset(cms, purlinProfile.widthMm)
      const δEnd = longPointOffset(cme, purlinProfile.widthMm)
      const lengthLongMm = depthMm + δStart + δEnd
      const kerf = Math.max(
        effectiveKerfMm(kerfMm, cms, 0),
        effectiveKerfMm(kerfMm, cme, 0),
      )
      if (lengthLongMm + kerf > maxStockMm + EPS_MM) anyTooLong = true

      if (depthMm > widestDepthMm) {
        widestDepthMm = depthMm
        widestH0S = h0.s
        widestH0Edge = h0.edgeIndex
        widestH1Edge = h1.edgeIndex
        widestT = t
      }
    }
  }

  if (!anyTooLong) return fallback()

  // ── Pass 2 (reversal): plan divider positions against the WIDEST span,
  // reusing Rule A's exact joint-priority + kerf-aware capacity logic.
  const { cutMiterDeg: repCms, cutHand: repChs } = cutAtEdge(perp, pts, widestH0Edge)
  const { cutMiterDeg: repCme, cutHand: repChe } = cutAtEdge(perp, pts, widestH1Edge)
  const repAnchor: Point2D = [dir[0] * widestT, dir[1] * widestT]
  const repStartPt: Point2D = [repAnchor[0] + widestH0S * perp[0], repAnchor[1] + widestH0S * perp[1]]

  const repPiece: CutPiece = {
    id: 'led-purlin-rep',
    role: 'purlin',
    profileId: purlinProfileId,
    lengthAxisMm: widestDepthMm,
    lengthLongMm: widestDepthMm,
    lengthShortMm: widestDepthMm,
    cutMiterStartDeg: repCms,
    cutBevelStartDeg: 0,
    cutHandStart: repChs,
    cutMiterEndDeg: repCme,
    cutBevelEndDeg: 0,
    cutHandEnd: repChe,
    position: [repStartPt[0], baseYmm, repStartPt[1]],
    rotation: [0, -(θ + HALF_PI), 0],
    color,
  }

  const reserveFirstMm = segmentReserveMm(repPiece, purlinProfile.widthMm, kerfMm, true, false)
  const reserveInternalMm = segmentReserveMm(repPiece, purlinProfile.widthMm, kerfMm, false, false)
  const reserveLastMm = segmentReserveMm(repPiece, purlinProfile.widthMm, kerfMm, false, true)
  const capacityMm = maxStockMm - Math.max(reserveFirstMm, reserveInternalMm, reserveLastMm)

  if (capacityMm <= MIN_SEGMENT_MM) {
    return {
      purlins: computePurlins(spec, profiles),
      dividers: [],
      issues: [{
        code: 'led-purlin-exceeds-stock-no-joint',
        message:
          `LED purlin profile "${purlinProfileId}"'s own end-cut geometry (miter offset + kerf) alone consumes ` +
          `${(maxStockMm - capacityMm).toFixed(1)}mm of the ${maxStockMm}mm stock, leaving no room for any real ` +
          `section. Needs a longer stock length upstream, not a divider.`,
        profileId: purlinProfileId,
        spanMm: widestDepthMm,
        maxStockMm,
      }],
      reversed: false,
    }
  }

  const candidates = findJointCandidates(repPiece, repStartPt, perp, widestDepthMm, existingPosts, crossingPieces)
  const plan = planBoundaries(widestDepthMm, capacityMm, candidates, true)

  if (!plan) {
    return {
      purlins: computePurlins(spec, profiles),
      dividers: [],
      issues: [{
        code: 'led-purlin-exceeds-stock-no-joint',
        message:
          `LED purlin profile "${purlinProfileId}" has a ${widestDepthMm.toFixed(0)}mm span, longer than the ` +
          `longest available stock (${maxStockMm}mm), and no divider placement was found to section it.`,
        profileId: purlinProfileId,
        spanMm: widestDepthMm,
        maxStockMm,
      }],
      reversed: false,
    }
  }

  const dividerProfileId = spec.ledDividerProfileId ?? spec.beamProfileId
  const dividerProfile = profiles.get(dividerProfileId)
  if (!dividerProfile) {
    throw new Error(`Divider profile "${dividerProfileId}" not found in profiles map`)
  }

  const dividerPerps = plan.boundaries.map((b) => widestH0S + b)
  const sectionBoundsPerp = [widestH0S, ...dividerPerps, widestH0S + widestDepthMm]

  // ── Dividers: plain crossing beams running along `dir` (like a lamella —
  // same scanLineClip convention, dir/perp swapped relative to the purlin
  // scan above) at each new depth.
  const dividers: CutPiece[] = []
  let divId = 0
  for (const p of dividerPerps) {
    const anchor: Point2D = [perp[0] * p, perp[1] * p]
    const hits = scanLineClip(dir, perp, p, anchor, pts)
    for (let k = 0; k + 1 < hits.length; k += 2) {
      const h0 = hits[k]
      const h1 = hits[k + 1]
      const lengthAxisMm = h1.s - h0.s
      if (lengthAxisMm < MIN_SEGMENT_MM) continue

      const { cutMiterDeg: cms, cutHand: chs } = cutAtEdge(dir, pts, h0.edgeIndex)
      const { cutMiterDeg: cme, cutHand: che } = cutAtEdge(dir, pts, h1.edgeIndex)
      const δStart = longPointOffset(cms, dividerProfile.widthMm)
      const δEnd = longPointOffset(cme, dividerProfile.widthMm)
      const startPt: Point2D = [anchor[0] + h0.s * dir[0], anchor[1] + h0.s * dir[1]]

      dividers.push({
        id: `led-divider-${divId++}`,
        role: 'purlin', // structurally a crossing member, like a purlin — see LedPurlinReversalResult doc.
        profileId: dividerProfileId,
        lengthAxisMm,
        lengthLongMm: lengthAxisMm + δStart + δEnd,
        lengthShortMm: lengthAxisMm - δStart - δEnd,
        cutMiterStartDeg: cms,
        cutBevelStartDeg: 0,
        cutHandStart: chs,
        cutMiterEndDeg: cme,
        cutBevelEndDeg: 0,
        cutHandEnd: che,
        position: [startPt[0], baseYmm, startPt[1]],
        rotation: [0, -θ, 0],
        color,
      })
    }
  }

  // ── Dense LED grid: one short LED purlin per (dense dir position ×
  // section), each independently clipped against the real contour and
  // against its own section's perp bounds.
  const maxLedStepMm = purlinProfile.maxLedStepMm ?? maxLamellaSpanMm
  const denseTs = computeSpanDivisionPointsMm(dirMin, dirMax, maxLedStepMm)
  const tsToUse = denseTs.length > 0 ? denseTs : sparseTs

  const ledPurlins: CutPiece[] = []
  const issues: LedReversalIssue[] = []
  let ledId = 0

  for (const t of tsToUse) {
    const anchor: Point2D = [dir[0] * t, dir[1] * t]
    const hits = scanLineClip(perp, dir, t, anchor, pts)

    for (let k = 0; k + 1 < hits.length; k += 2) {
      const h0 = hits[k]
      const h1 = hits[k + 1]
      if (h1.s - h0.s < MIN_SEGMENT_MM) continue

      for (let s = 0; s + 1 < sectionBoundsPerp.length; s++) {
        const pStart = sectionBoundsPerp[s]
        const pEnd = sectionBoundsPerp[s + 1]
        const effStart = Math.max(h0.s, pStart)
        const effEnd = Math.min(h1.s, pEnd)
        const lengthAxisMm = effEnd - effStart
        if (lengthAxisMm < MIN_SEGMENT_MM) continue

        const atRealStart = Math.abs(effStart - h0.s) <= EPS_MM
        const atRealEnd = Math.abs(effEnd - h1.s) <= EPS_MM
        const startCut = atRealStart ? cutAtEdge(perp, pts, h0.edgeIndex) : { cutMiterDeg: 0, cutHand: 'straight' as const }
        const endCut = atRealEnd ? cutAtEdge(perp, pts, h1.edgeIndex) : { cutMiterDeg: 0, cutHand: 'straight' as const }

        const δStart = longPointOffset(startCut.cutMiterDeg, purlinProfile.widthMm)
        const δEnd = longPointOffset(endCut.cutMiterDeg, purlinProfile.widthMm)
        const lengthLongMm = lengthAxisMm + δStart + δEnd

        // Defensive check (see SIMPLIFICATION above): a highly irregular
        // contour could in principle have a column deeper than the
        // "widest sparse" one this section was sized against — never
        // silently hand the saw a piece it can't cut, report it instead.
        const kerf = Math.max(
          effectiveKerfMm(kerfMm, startCut.cutMiterDeg, 0),
          effectiveKerfMm(kerfMm, endCut.cutMiterDeg, 0),
        )
        if (lengthLongMm + kerf > maxStockMm + EPS_MM) {
          issues.push({
            code: 'led-purlin-exceeds-stock-no-joint',
            message:
              `LED purlin profile "${purlinProfileId}": a dense sub-piece at dir=${t.toFixed(0)}mm still needs ` +
              `${(lengthLongMm + kerf).toFixed(1)}mm, over the ${maxStockMm}mm stock — this column's depth ` +
              `exceeds the widest sparse crossing this section plan was sized against; add a manual divider here.`,
            profileId: purlinProfileId,
            spanMm: lengthLongMm,
            maxStockMm,
          })
          continue
        }

        const startPt: Point2D = [anchor[0] + effStart * perp[0], anchor[1] + effStart * perp[1]]

        ledPurlins.push({
          id: `led-purlin-${ledId++}`,
          role: 'purlin',
          profileId: purlinProfileId,
          lengthAxisMm,
          lengthLongMm,
          lengthShortMm: lengthAxisMm - δStart - δEnd,
          cutMiterStartDeg: startCut.cutMiterDeg,
          cutBevelStartDeg: 0,
          cutHandStart: startCut.cutHand,
          cutMiterEndDeg: endCut.cutMiterDeg,
          cutBevelEndDeg: 0,
          cutHandEnd: endCut.cutHand,
          position: [startPt[0], baseYmm, startPt[1]],
          rotation: [0, -(θ + HALF_PI), 0],
          color,
        })
      }
    }
  }

  return { purlins: ledPurlins, dividers, issues, reversed: true }
}
