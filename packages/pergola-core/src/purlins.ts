import type { Point2D, Vector2D, CutPiece, PergolaSpec, ProfileDimensions } from './types'
import { edgeIndicesInCcwOrder, isCCW } from './miter'
import { scanLineClip, cutAtEdge, longPointOffset } from './lamellas'
import { resolveContourPurlinPositions } from './lamellaSpans'
import { resolveLamellaPattern, patternMaxLamellaSpanMm, patternMaxVerticalThicknessMm } from './lamellaPattern'
import { sanitizeContour } from './contourSanitize'
import { isHorizontalPlane, offsetAlongNormal, placeOnRoof, roofPlane, type RoofPlane } from './roof'
import { computeFrame } from './frame'
import { beamPlanWidthForDrawing, wingShelfFlushBandMm } from './beamPlanWidth'
import { placeWingShelfFlushBand } from './wingShelfSpan'
import {
  collectFrameBeamTrimSegments,
  measuredOutersForCcwContour,
  trimDividerAxisSegmentsForFrame,
} from './dividerFrameTrim'
import {
  resolveAllWingShelfSupports,
  WING_SHELF_SPAN_DIVIDER_ID,
  type WingShelfSupport,
} from './planEditorDimensions'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from './planDefaults'
import { isRetiredProfileId } from './pergolaProfiles'

const RAD = Math.PI / 180
const HALF_PI = Math.PI / 2

function dot2(a: Vector2D, b: Vector2D): number { return a[0] * b[0] + a[1] * b[1] }

/** Segments shorter than this (mm) are discarded as degenerate — same threshold as lamellas.ts. */
const MIN_SEGMENT_MM = 1.0

const SQUARE_END = { cutMiterDeg: 0, cutHand: 'straight' as const }

function distPointToSeg(point: Point2D, a: Point2D, b: Point2D): number {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-9) return Math.hypot(point[0] - a[0], point[1] - a[1])
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * abx + (point[1] - a[1]) * aby) / len2))
  return Math.hypot(point[0] - (a[0] + abx * t), point[1] - (a[1] + aby * t))
}

/** Miter where a shelf end meets a frame side. A side parallel to the shelf is the notch beam, not the cut. */
function shelfEndCut(
  point: Point2D,
  shelfDir: Vector2D,
  contour: Point2D[],
): { cutMiterDeg: number; cutHand: 'L' | 'R' | 'straight' } {
  let best = -1
  let bestDist = 80
  const n = contour.length
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const edgeLen = Math.hypot(dx, dy)
    if (edgeLen < 1) continue
    if (Math.abs((dx * shelfDir[0] + dy * shelfDir[1]) / edgeLen) > 0.98) continue
    const dist = distPointToSeg(point, a, b)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  if (best < 0) return SQUARE_END
  const cut = cutAtEdge(shelfDir, contour, best)
  if (cut.cutMiterDeg < 3) return SQUARE_END
  return cut
}

/**
 * Contour miter only when this end of a trimmed piece is still the clip end.
 * A shelf or notch split leaves the other end square (90° to the axis).
 */
function cutAtDividerEnd(
  point: Point2D,
  clipEnd: Point2D,
  otherClipEnd: Point2D,
  contourCut: () => { cutMiterDeg: number; cutHand: 'L' | 'R' | 'straight' },
): { cutMiterDeg: number; cutHand: 'L' | 'R' | 'straight' } {
  const near = Math.hypot(point[0] - clipEnd[0], point[1] - clipEnd[1])
  const far = Math.hypot(point[0] - otherClipEnd[0], point[1] - otherClipEnd[1])
  const span = Math.hypot(otherClipEnd[0] - clipEnd[0], otherClipEnd[1] - clipEnd[1])
  if (near + 1 < far && near < Math.max(180, span * 0.35)) return contourCut()
  return SQUARE_END
}

/**
 * Compute all purlin (intermediate rafter) CutPieces for one pergola.
 *
 * A purlin runs PERPENDICULAR to the lamellas, at Max equal-clear positions
 * along the lamella direction, one crossing line whenever the unsupported
 * span of a lamella would otherwise exceed lamellaProfile.maxLamellaSpanMm
 * (see resolvePurlinPositionsMm — same helper, and the same crossing
 * points, that computeLamellas uses to segment lamellas when the purlin
 * profile has interruptsLamella: true, so a purlin and a lamella segment
 * boundary always agree).
 *
 * Each crossing line is itself clipped against the (possibly non-convex)
 * contour via scanLineClip — exactly the same machinery computeLamellas uses,
 * with `dir`/`perp` swapped, so a purlin can legitimately come back as
 * several disjoint pieces (e.g. crossing an L-shaped notch) or as nothing at
 * all for a crossing line that misses the polygon.
 *
 * Returns [] when spec.purlinProfileId is unset, or when the lamella
 * profile's maxLamellaSpanMm is unset/non-positive, or when the polygon's
 * extent along the lamella direction already fits in one span — no purlins
 * needed. Does NOT depend on interruptsLamella: that flag only controls
 * whether computeLamellas also segments the lamella at these same crossings;
 * a non-interrupting purlin (mounted above the lamella plane) still exists
 * as a real CutPiece here.
 *
 * Span-limit note (see prompt "смешанные ламели"): when spec.lamellaPattern
 * mixes several lamella profiles, the span used against maxLamellaSpanMm is
 * patternMaxLamellaSpanMm — the SMALLEST value among all profiles in the
 * pattern (thinnest slat governs) — resolved through the exact same
 * resolveLamellaPattern call computeLamellas uses, so the two always agree
 * on the same crossing points.
 *
 * VERTICAL SEATING RULE (position[1], mm above ground):
 *   Both perimeter beams and lamellas sit on the same "based" baseline —
 *   position.y = spec.heightMm is their BOTTOM face (see geometryBuilder.ts
 *   zMode: 'based' for every non-post role), so a lamella's bottom is already
 *   flush with a beam's bottom at heightMm with NO offset needed here.
 *     • interruptsLamella === true  → the purlin REPLACES the lamella at
 *       that crossing (see computeLamellas SEGMENTATION), so it occupies the
 *       exact same vertical band: position.y = heightMm, same as the
 *       lamella/beam bottom. It simply rises higher (purlinProfile.heightMm,
 *       typically taller than a lamella) while staying inside the beam's own
 *       height envelope.
 *     • interruptsLamella === false (or unset) → the purlin is mounted ABOVE
 *       the lamella plane and must NOT touch it (computeLamellas keeps the
 *       lamella continuous through this crossing): position.y = heightMm +
 *       patternMaxVerticalThicknessMm(pattern) — the lamella's own top face.
 *       The TALLEST lamella profile in a mixed pattern governs (it must
 *       clear every row it crosses, not just the thinnest one).
 *
 * @param spec      PergolaSpec; contour auto-normalised to CCW winding.
 * @param profiles  Map from profileId → ProfileDimensions.
 *                  Must contain every profile id in spec.lamellaPattern (or
 *                  spec.lamellaProfileId when unset) and purlinProfileId (if set).
 */
export function computePurlins(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  roof?: RoofPlane,
  options?: { frameBeams?: CutPiece[] },
): CutPiece[] {
  const { contour, lamellaDirectionDeg, heightMm, color, purlinProfileId } = spec

  if (!purlinProfileId) return []

  const pattern = resolveLamellaPattern(spec, profiles)
  const maxLamellaSpanMm = patternMaxLamellaSpanMm(pattern)
  const purlinProfile = profiles.get(purlinProfileId)
  if (!purlinProfile) {
    throw new Error(`Profile "${purlinProfileId}" not found in profiles map`)
  }

  const plane = roof ?? roofPlane(spec)
  const sloped = !isHorizontalPlane(plane)
  const aboveLamellaMm = purlinProfile.interruptsLamella === true
    ? 0
    : patternMaxVerticalThicknessMm(pattern)
  // See VERTICAL SEATING RULE above. Flat roof keeps the historic world-Y seat.
  const baseYmm = heightMm + aboveLamellaMm

  // Same entry-point sanitisation as computeFrame/computeLamellas (see
  // contourSanitize.ts) — computePurlins is called independently of both.
  const cleanContour = sanitizeContour(contour)
  const pts: Point2D[] = isCCW(cleanContour) ? cleanContour : [...cleanContour].reverse()
  const measuredCcw = measuredOutersForCcwContour(cleanContour, spec.measuredOuterLengthMmByEdgeIndex)

  const θ = lamellaDirectionDeg * RAD
  // Purlin length axis runs along `perp` (⊥ to the lamellas); its own scan
  // coordinate — the one held fixed per crossing line — is `dir`.
  const dir: Vector2D  = [Math.cos(θ), Math.sin(θ)]
  const perp: Vector2D = [-Math.sin(θ), Math.cos(θ)]

  const divisionPoints = resolveContourPurlinPositions({
    contour: pts,
    lamellaDirectionDeg: spec.lamellaDirectionDeg,
    maxSpanMm: maxLamellaSpanMm,
    mode: spec.purlinDividers?.mode,
    lines: spec.purlinDividers?.lines,
    profiles,
    beamProfileId: spec.beamProfileId,
    wallProfileId: spec.wallProfileId,
    // `pts` is the counter-clockwise copy, so walls are re-indexed to it.
    wallEdgeIndices: edgeIndicesInCcwOrder(cleanContour, spec.wallEdgeIndices),
    wallBeamWidthVersion: spec.wallBeamWidthVersion,
    measuredOuterLengthMmByEdgeIndex: measuredCcw,
    layoutVersion: spec.purlinClearLayoutVersion === 1 ? 1 : undefined,
  })

  const frameBeams =
    options?.frameBeams ??
    (profiles.get(spec.beamProfileId) != null
      ? computeFrame(spec, profiles).beams
      : [])
  const beamTrim = collectFrameBeamTrimSegments(frameBeams, profiles)
  const shelfParams = {
    ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
    lamellaDirectionDeg: spec.lamellaDirectionDeg,
    beamProfileId: spec.beamProfileId,
    purlinProfileId: spec.purlinProfileId ?? DEFAULT_PLAN_CONSTRUCTION_PARAMS.purlinProfileId,
    purlinDividers: spec.purlinDividers ?? { mode: 'auto' as const },
    measuredOuterLengthMmByEdgeIndex: spec.measuredOuterLengthMmByEdgeIndex,
    purlinClearLayoutVersion: spec.purlinClearLayoutVersion,
    purlinMaxSpanMm: spec.purlinMaxSpanMm,
    postMaxSpanMm: spec.postMaxSpanMm,
    wingShelfProfileId: spec.wingShelfProfileId,
    wallProfileId: spec.wallProfileId,
    wallBeamWidthVersion: spec.wallBeamWidthVersion,
  }
  const wingSupports = resolveAllWingShelfSupports({
    contour: cleanContour,
    params: shelfParams,
    profiles,
    beams: frameBeams,
    wallEdgeIndices: spec.wallEdgeIndices,
  })
  // The shelf stays on the notch centerline. The flush band is only for a
  // wall that is narrower than the free beam. A wall profile with no wall
  // edge does not move the shelf.
  const hasWallEdge = (spec.wallEdgeIndices?.length ?? 0) > 0
  const flushBandMm = hasWallEdge
    ? wingShelfFlushBandMm(
        profiles,
        spec.beamProfileId,
        spec.wallProfileId,
        spec.wallBeamWidthVersion,
      )
    : null
  const wingShelfClips = wingSupports
    .filter((s) => s.lengthMm >= MIN_SEGMENT_MM)
    .map((wingSupport) => {
      const flushBand =
        flushBandMm != null ? placeWingShelfFlushBand(wingSupport, cleanContour, flushBandMm) : null
      const shelfHalfWidthMm = beamPlanWidthForDrawing(profiles, wingSupport.profileId).planWidthMm / 2
      return flushBand != null
        ? {
            start: flushBand.clipStart,
            end: flushBand.clipEnd,
            lengthMm: wingSupport.lengthMm,
            halfWidthMm: shelfHalfWidthMm,
            support: wingSupport,
            flushBand,
          }
        : {
            start: wingSupport.start,
            end: wingSupport.end,
            lengthMm: wingSupport.lengthMm,
            halfWidthMm: shelfHalfWidthMm,
            support: wingSupport,
            flushBand: null as ReturnType<typeof placeWingShelfFlushBand> | null,
          }
    })

  const pieces: CutPiece[] = []
  let id = 0

  for (const { id: dividerId, positionMm: t } of divisionPoints) {
    const anchor: Point2D = [dir[0] * t, dir[1] * t]
    const hits = scanLineClip(perp, dir, t, anchor, pts)

    for (let k = 0; k + 1 < hits.length; k += 2) {
      const h0 = hits[k]
      const h1 = hits[k + 1]
      const clipLen = h1.s - h0.s
      if (clipLen < MIN_SEGMENT_MM) continue

      const clipStart: Point2D = [
        anchor[0] + h0.s * perp[0],
        anchor[1] + h0.s * perp[1],
      ]
      const clipEnd: Point2D = [
        anchor[0] + h1.s * perp[0],
        anchor[1] + h1.s * perp[1],
      ]

      const trimmed = trimDividerAxisSegmentsForFrame({
        start: clipStart,
        end: clipEnd,
        beams: beamTrim,
        minLengthMm: MIN_SEGMENT_MM,
        wingShelfClips: wingShelfClips.map(({ start, end, halfWidthMm }) => ({
          start,
          end,
          halfWidthMm,
        })),
        contour: pts,
        measuredOuterLengthMmByEdgeIndex: measuredCcw,
        ignoreBeamsBehindEnds: true,
      })

      for (const seg of trimmed) {
        const startPt = seg.start
        const endPt = seg.end
        const lengthAxisMm = seg.lengthAxisMm

        // A shelf split keeps the contour miter only on the end that still
        // meets that edge. The end on the shelf is a square cut.
        const startCut = cutAtDividerEnd(startPt, clipStart, clipEnd, () => cutAtEdge(perp, pts, h0.edgeIndex))
        const endCut = cutAtDividerEnd(endPt, clipEnd, clipStart, () => cutAtEdge(perp, pts, h1.edgeIndex))
        const cms = startCut.cutMiterDeg
        const chs = startCut.cutHand
        const cme = endCut.cutMiterDeg
        const che = endCut.cutHand

        const δStart = longPointOffset(cms, purlinProfile.widthMm)
        const δEnd = longPointOffset(cme, purlinProfile.widthMm)
        const placed = sloped ? placeOnRoof(startPt, endPt, plane) : null
        const axisMm = placed?.axisMm ?? lengthAxisMm

        pieces.push({
          id: `purlin-${id++}`,
          role: 'purlin',
          dividerId,
          clipPlanStart: clipStart,
          clipPlanEnd: clipEnd,
          profileId: purlinProfileId,

          lengthAxisMm: axisMm,
          lengthLongMm: axisMm + δStart + δEnd,
          lengthShortMm: axisMm - δStart - δEnd,

          cutMiterStartDeg: cms,
          cutBevelStartDeg: 0,
          cutHandStart: chs,

          cutMiterEndDeg: cme,
          cutBevelEndDeg: 0,
          cutHandEnd: che,

          position: placed
            ? offsetAlongNormal(placed.position, plane, aboveLamellaMm)
            : [startPt[0], baseYmm, startPt[1]],
          rotation: placed?.rotation ?? [0, -(θ + HALF_PI), 0],
          color,
        })
      }
    }
  }

  for (const clip of wingShelfClips) {
    const wingSupport: WingShelfSupport = clip.support
    if (!profiles.has(wingSupport.profileId)) continue
    const shelfProfileId = wingSupport.profileId
    const startPt = clip.flushBand?.axisStart ?? wingSupport.start
    const endPt = clip.flushBand?.axisEnd ?? wingSupport.end
    const lengthAxisMm = wingSupport.lengthMm
    const placed = sloped ? placeOnRoof(startPt, endPt, plane) : null
    const axisMm = placed?.axisMm ?? lengthAxisMm
    const shelfDx = endPt[0] - startPt[0]
    const shelfDy = endPt[1] - startPt[1]
    const shelfLen = Math.hypot(shelfDx, shelfDy) || 1
    const shelfDir: Vector2D = [shelfDx / shelfLen, shelfDy / shelfLen]
    const shelfθ = Math.atan2(shelfDy, shelfDx)
    const cutShelfEnd = !isRetiredProfileId(shelfProfileId)
    const startCut = cutShelfEnd ? shelfEndCut(startPt, shelfDir, pts) : SQUARE_END
    const endCut = cutShelfEnd ? shelfEndCut(endPt, shelfDir, pts) : SQUARE_END
    const shelfWidth = profiles.get(shelfProfileId)?.widthMm ?? 40
    const shelfLong = longPointOffset(startCut.cutMiterDeg, shelfWidth) + longPointOffset(endCut.cutMiterDeg, shelfWidth)
    pieces.push({
      id: `purlin-${id++}`,
      role: 'purlin',
      dividerId: WING_SHELF_SPAN_DIVIDER_ID,
      clipPlanStart: startPt,
      clipPlanEnd: endPt,
      profileId: shelfProfileId,
      lengthAxisMm: axisMm,
      lengthLongMm: axisMm + shelfLong,
      lengthShortMm: axisMm - shelfLong,
      cutMiterStartDeg: startCut.cutMiterDeg,
      cutBevelStartDeg: 0,
      cutHandStart: startCut.cutHand,
      cutMiterEndDeg: endCut.cutMiterDeg,
      cutBevelEndDeg: 0,
      cutHandEnd: endCut.cutHand,
      position: placed
        ? offsetAlongNormal(placed.position, plane, 0)
        : [startPt[0], heightMm, startPt[1]],
      rotation: placed?.rotation ?? [0, -shelfθ, 0],
      color,
    })
  }

  return pieces
}
