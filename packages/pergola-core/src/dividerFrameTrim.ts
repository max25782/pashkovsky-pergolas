import type { CutPiece, Point2D, ProfileDimensions } from './types'
import { beamPlanWidthForDrawing, DIVIDER_PLAN_CLEARANCE_WIDTH_MM } from './beamPlanWidth'
import { pieceAxis } from './pieceAxis'
import { edgeValuesInCcwOrder, isCCW } from './miter'
import {
  axisToInnerFaceMm,
  contourVerticesAreOuterFaces,
  type PurlinClearLayoutVersion,
} from './lamellaSpans'

const MIN_FREE_MM = 1
const PARALLEL_ANGLE_TOLERANCE_DEG = 0.5
const COLINEAR_DIST_EPS_MM = 0.5
const PARALLEL_COS = Math.cos((PARALLEL_ANGLE_TOLERANCE_DEG * Math.PI) / 180)
const EDGE_MATCH_EPS_MM = 1.5

function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}
function add(a: Point2D, b: Point2D): Point2D {
  return [a[0] + b[0], a[1] + b[1]]
}
function scale(a: Point2D, s: number): Point2D {
  return [a[0] * s, a[1] * s]
}
function dot(a: Point2D, b: Point2D): number {
  return a[0] * b[0] + a[1] * b[1]
}
function segmentLength(a: Point2D, b: Point2D): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1])
}
function unit(a: Point2D): Point2D {
  const l = segmentLength([0, 0], a)
  return l > 1e-9 ? scale(a, 1 / l) : [1, 0]
}

export interface FrameBeamTrimSegment {
  start: Point2D
  end: Point2D
  /**
   * Half plan width. Kept for collinear footprint tests and callers that still
   * treat the beam as a symmetric band; face trim uses axisToInner/Outer.
   */
  halfWidthMm: number
  /** Axis → face toward polygon interior (full width on outer verts, half on centerline). */
  axisToInnerFaceMm: number
  /** Axis → face away from interior (0 on outer verts, half on centerline). */
  axisToOuterFaceMm: number
  /** Unit inward (left of travel on a CCW contour). */
  inward: Point2D
}

export interface CollectFrameBeamTrimOptions {
  contour?: Point2D[]
  measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
  layoutVersion?: PurlinClearLayoutVersion
}

function edgeInwardUnit(a: Point2D, b: Point2D, contourIsCcw: boolean): Point2D {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return [0, 1]
  const left: Point2D = [-dy / len, dx / len]
  return contourIsCcw ? left : scale(left, -1)
}

function matchBeamContourEdge(
  start: Point2D,
  end: Point2D,
  contour: Point2D[],
): number {
  const n = contour.length
  if (n < 2) return -1
  const mid: Point2D = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
  const bDir = unit(sub(end, start))
  let best = -1
  let bestDist = EDGE_MATCH_EPS_MM
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    const eLen = segmentLength(a, b)
    if (eLen < MIN_FREE_MM) continue
    const eDir = unit(sub(b, a))
    if (Math.abs(dot(bDir, eDir)) < PARALLEL_COS) continue
    const rel = sub(mid, a)
    const dist = Math.abs(rel[0] * eDir[1] - rel[1] * eDir[0])
    const t = dot(rel, eDir)
    if (t < -EDGE_MATCH_EPS_MM || t > eLen + EDGE_MATCH_EPS_MM) continue
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

function faceInsetsForPlanWidth(
  planWidthMm: number,
  contourIsOuter: boolean | undefined,
  layoutVersion: PurlinClearLayoutVersion | undefined,
): { inner: number; outer: number } {
  const inner = axisToInnerFaceMm({
    planWidthMm,
    axisLengthMm: 0,
    layoutVersion,
    contourIsOuter,
  })
  const outer = Math.max(0, planWidthMm - inner)
  return { inner, outer }
}

/** Inset from the axis to the face that lies on the `approachDir` side of the beam. */
function faceInsetToward(
  beam: Pick<FrameBeamTrimSegment, 'axisToInnerFaceMm' | 'axisToOuterFaceMm' | 'inward'>,
  approachDir: Point2D,
): number {
  return dot(approachDir, beam.inward) >= 0 ? beam.axisToInnerFaceMm : beam.axisToOuterFaceMm
}

export function collectFrameBeamTrimSegments(
  beams: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
  options?: CollectFrameBeamTrimOptions,
): FrameBeamTrimSegment[] {
  const contour = options?.contour
  const measured = options?.measuredOuterLengthMmByEdgeIndex
  const layoutVersion = options?.layoutVersion
  const contourIsOuter =
    contour != null ? contourVerticesAreOuterFaces(contour, measured) : false
  const ccw = contour != null && contour.length >= 3 ? isCCW(contour) : true
  const out: FrameBeamTrimSegment[] = []
  for (const beam of beams) {
    if (beam.role !== 'beam') continue
    const { start, end } = pieceAxis(beam)
    const planWidthMm = beamPlanWidthForDrawing(profiles, beam.profileId).planWidthMm
    const halfWidthMm = planWidthMm / 2
    const faces = faceInsetsForPlanWidth(planWidthMm, contourIsOuter, layoutVersion)
    let inward: Point2D = edgeInwardUnit(start, end, true)
    if (contour != null && contour.length >= 2) {
      const edgeIndex = matchBeamContourEdge(start, end, contour)
      if (edgeIndex >= 0) {
        const a = contour[edgeIndex]
        const b = contour[(edgeIndex + 1) % contour.length]
        inward = edgeInwardUnit(a, b, ccw)
      }
    }
    out.push({
      start,
      end,
      halfWidthMm,
      axisToInnerFaceMm: faces.inner,
      axisToOuterFaceMm: faces.outer,
      inward,
    })
  }
  return out
}

function segmentsParallel(a0: Point2D, a1: Point2D, b0: Point2D, b1: Point2D): boolean {
  const ua = unit(sub(a1, a0))
  const ub = unit(sub(b1, b0))
  return Math.abs(dot(ua, ub)) >= PARALLEL_COS
}

function distancePointToInfiniteLine(p: Point2D, a: Point2D, b: Point2D): number {
  const u = unit(sub(b, a))
  const perp: Point2D = [-u[1], u[0]]
  return Math.abs(dot(sub(p, a), perp))
}

function projectAlong(p: Point2D, origin: Point2D, dir: Point2D): number {
  return dot(sub(p, origin), dir)
}

/** Parameter of the purlin axis where it crosses the beam segment. Null when parallel or the crossing misses the segment. */
function axisHitOnBeamSegment(origin: Point2D, dir: Point2D, beamStart: Point2D, beamEnd: Point2D): number | null {
  const sx = beamEnd[0] - beamStart[0]
  const sy = beamEnd[1] - beamStart[1]
  const denom = dir[0] * sy - dir[1] * sx
  if (Math.abs(denom) < 1e-9) return null
  const t = ((beamStart[0] - origin[0]) * sy - (beamStart[1] - origin[1]) * sx) / denom
  const s = ((beamStart[0] - origin[0]) * dir[1] - (beamStart[1] - origin[1]) * dir[0]) / denom
  if (s < -1e-6 || s > 1 + 1e-6) return null
  return t
}

function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const cur = sorted[i]
    if (cur[0] <= last[1] + COLINEAR_DIST_EPS_MM) {
      last[1] = Math.max(last[1], cur[1])
    } else {
      merged.push(cur)
    }
  }
  return merged
}

/** Clip segment ends to inner faces of frame beams that meet the segment near its endpoints. */
export function trimAxisSegmentToInnerFaces(input: {
  start: Point2D
  end: Point2D
  beams: FrameBeamTrimSegment[]
  /**
   * Purlin rows start and end on a contour edge, so a beam crossing far
   * behind an end belongs to the opposite side of a notch, not to this end.
   * Without this a far-behind hit wins the "one beam per end" pick and the
   * real end beam is dropped (U fixture: 2980 instead of 2960).
   * Shelf spans keep the older pick: a retired shelf stays square at the
   * beam half (diagonal plan 3583.4), the skew face is a separate step.
   */
  ignoreBeamsBehindEnds?: boolean
}): { start: Point2D; end: Point2D; lengthMm: number } {
  const { start, end, beams, ignoreBeamsBehindEnds = false } = input
  const axisLen = segmentLength(start, end)
  if (axisLen < MIN_FREE_MM) return { start, end: start, lengthMm: 0 }
  const dir = unit(sub(end, start))
  let t0 = 0
  let t1 = axisLen
  // One beam per end. A corner neighbor crosses the same point; taking both
  // insets would eat a second beam width (the G-shelf clear is one face each end).
  let startCap: { tHit: number; face: number } | null = null
  let endCap: { tHit: number; face: number } | null = null

  for (const beam of beams) {
    const beamLen = segmentLength(beam.start, beam.end)
    if (beamLen < MIN_FREE_MM) continue
    const beamDir = scale(sub(beam.end, beam.start), 1 / beamLen)
    const sinPhi = Math.abs(dir[0] * beamDir[1] - dir[1] * beamDir[0])
    if (sinPhi < Math.sin((0.5 * Math.PI) / 180)) continue

    const tHit = axisHitOnBeamSegment(start, dir, beam.start, beam.end)
    if (tHit == null) continue
    // Face distance from the axis toward the kept side of the purlin. Outer-contour
    // beams are one-sided (full width inward, 0 outward); centerline beams stay ±half.
    // A diagonal spreads that offset by 1/sin(phi).
    const startFaceMm = faceInsetToward(beam, dir)
    const endFaceMm = faceInsetToward(beam, scale(dir, -1))
    const startInset = startFaceMm / sinPhi
    const endInset = endFaceMm / sinPhi
    const reach = Math.max(startInset, endInset) + beam.halfWidthMm
    if ((!ignoreBeamsBehindEnds || tHit >= -reach) && tHit <= reach && tHit < axisLen * 0.5) {
      const face = tHit + startInset
      const closer = startCap == null || tHit < startCap.tHit - 0.5
      const tied = startCap != null && Math.abs(tHit - startCap.tHit) <= 0.5 && face < startCap.face
      if (closer || tied) startCap = { tHit, face }
    }
    if ((!ignoreBeamsBehindEnds || tHit <= axisLen + reach) && tHit >= axisLen - reach && tHit > axisLen * 0.5) {
      const face = tHit - endInset
      const closer = endCap == null || tHit > endCap.tHit + 0.5
      const tied = endCap != null && Math.abs(tHit - endCap.tHit) <= 0.5 && face > endCap.face
      if (closer || tied) endCap = { tHit, face }
    }
  }
  if (startCap) t0 = Math.max(t0, startCap.face)
  if (endCap) t1 = Math.min(t1, endCap.face)

  if (t1 <= t0 + MIN_FREE_MM) {
    return { start, end: start, lengthMm: 0 }
  }
  return {
    start: add(start, scale(dir, t0)),
    end: add(start, scale(dir, t1)),
    lengthMm: t1 - t0,
  }
}

/**
 * Remove portions of a divider segment that lie on frame beam footprints (collinear
 * and within combined half-widths). Returns free sub-segments for CutPiece / overlay.
 */
export function trimDividerSegmentAgainstFrameBeams(input: {
  start: Point2D
  end: Point2D
  dividerHalfWidthMm: number
  beams: FrameBeamTrimSegment[]
}): Array<{ start: Point2D; end: Point2D }> {
  const { start, end, dividerHalfWidthMm, beams } = input
  const axisLen = segmentLength(start, end)
  if (axisLen < MIN_FREE_MM) return []

  const dir = unit(sub(end, start))
  const blocked: Array<[number, number]> = []

  for (const beam of beams) {
    if (!segmentsParallel(start, end, beam.start, beam.end)) continue
    const lineDist = distancePointToInfiniteLine(beam.start, start, end)
    const overlapDist = beam.halfWidthMm + dividerHalfWidthMm + COLINEAR_DIST_EPS_MM
    if (lineDist > overlapDist) continue

    const t0 = projectAlong(beam.start, start, dir)
    const t1 = projectAlong(beam.end, start, dir)
    const lo = Math.min(t0, t1) - beam.halfWidthMm
    const hi = Math.max(t0, t1) + beam.halfWidthMm
    const a = Math.max(0, lo)
    const b = Math.min(axisLen, hi)
    if (b > a + COLINEAR_DIST_EPS_MM) blocked.push([a, b])
  }

  const merged = mergeIntervals(blocked)
  const free: Array<{ start: Point2D; end: Point2D }> = []
  let cursor = 0
  for (const [lo, hi] of merged) {
    if (lo > cursor + MIN_FREE_MM) {
      free.push({ start: add(start, scale(dir, cursor)), end: add(start, scale(dir, lo)) })
    }
    cursor = Math.max(cursor, hi)
  }
  if (axisLen > cursor + MIN_FREE_MM) {
    free.push({ start: add(start, scale(dir, cursor)), end: add(start, scale(dir, axisLen)) })
  }
  return free
}

export interface TrimmedDividerAxisSegment {
  start: Point2D
  end: Point2D
  lengthAxisMm: number
}

/** Inner faces at ends, then subtract collinear frame-beam overlap (all dividers/purlins). */
function intersectCollinearSegments(
  a0: Point2D,
  a1: Point2D,
  b0: Point2D,
  b1: Point2D,
): { start: Point2D; end: Point2D } | null {
  const dir = unit(sub(a1, a0))
  if (!segmentsParallel(a0, a1, b0, b1)) return null
  if (distancePointToInfiniteLine(b0, a0, a1) > COLINEAR_DIST_EPS_MM) return null
  const t0 = projectAlong(b0, a0, dir)
  const t1 = projectAlong(b1, a0, dir)
  const lo = Math.max(0, Math.min(t0, t1))
  const hi = Math.min(segmentLength(a0, a1), Math.max(t0, t1))
  if (hi <= lo + MIN_FREE_MM) return null
  return { start: add(a0, scale(dir, lo)), end: add(a0, scale(dir, hi)) }
}

/** Shelf outer beam past the notch (upper-wing bottom) — collinear trim only, not a CutPiece. */
export function wingShelfOuterBeamTrimSegment(
  shelf: { start: Point2D; end: Point2D },
  beams: FrameBeamTrimSegment[],
  beamHalfWidthMm: number,
): FrameBeamTrimSegment | null {
  const inner = trimAxisSegmentToInnerFaces({ start: shelf.start, end: shelf.end, beams })
  const dx = shelf.end[0] - inner.end[0]
  const dy = shelf.end[1] - inner.end[1]
  if (Math.hypot(dx, dy) < MIN_FREE_MM) return null
  return {
    start: inner.end,
    end: shelf.end,
    halfWidthMm: beamHalfWidthMm,
    axisToInnerFaceMm: beamHalfWidthMm,
    axisToOuterFaceMm: beamHalfWidthMm,
    inward: edgeInwardUnit(inner.end, shelf.end, true),
  }
}

function longestTrimmedSegment(
  shelfRaw: { start: Point2D; end: Point2D },
  beams: FrameBeamTrimSegment[],
): { start: Point2D; end: Point2D; lengthMm: number } {
  const parts = trimDividerAxisSegmentsForFrame({
    start: shelfRaw.start,
    end: shelfRaw.end,
    beams,
    minLengthMm: MIN_FREE_MM,
  })
  if (parts.length === 0) {
    return { start: shelfRaw.start, end: shelfRaw.start, lengthMm: 0 }
  }
  let best = parts[0]
  for (const p of parts) {
    if (p.lengthAxisMm > best.lengthAxisMm) best = p
  }
  return { start: best.start, end: best.end, lengthMm: best.lengthAxisMm }
}

/** Inner-face to inner-face clear along the shelf (report / overlay). */
export function wingShelfInnerClearSpanFromRaw(
  shelfRaw: { start: Point2D; end: Point2D },
  beams: FrameBeamTrimSegment[],
): { start: Point2D; end: Point2D; lengthMm: number } {
  return longestTrimmedSegment(shelfRaw, beams)
}

/** Free span for purlins on the shelf: also subtracts outer shelf beam past the notch. */
export function wingShelfFreeSpanFromRaw(
  shelfRaw: { start: Point2D; end: Point2D },
  beams: FrameBeamTrimSegment[],
  beamHalfWidthMm: number,
): { start: Point2D; end: Point2D; lengthMm: number } {
  const trimBeams = [...beams]
  const outer = wingShelfOuterBeamTrimSegment(shelfRaw, beams, beamHalfWidthMm)
  if (outer) trimBeams.push(outer)
  return longestTrimmedSegment(shelfRaw, trimBeams)
}

export interface WingShelfTrimClip {
  start: Point2D
  end: Point2D
  halfWidthMm?: number
  axisToInnerFaceMm?: number
  axisToOuterFaceMm?: number
  inward?: Point2D
}

/** Half plan width of the frame beam the shelf clip lies on. Fallback is half of 40 mm. */
function beamHalfAlongClip(
  clip: { start: Point2D; end: Point2D },
  beams: FrameBeamTrimSegment[],
): number {
  const fallback = DIVIDER_PLAN_CLEARANCE_WIDTH_MM / 2
  let bestDist = Infinity
  let best = fallback
  for (const beam of beams) {
    if (!segmentsParallel(clip.start, clip.end, beam.start, beam.end)) continue
    const dist = distancePointToInfiniteLine(clip.start, beam.start, beam.end)
    if (dist < bestDist) {
      bestDist = dist
      best = beam.halfWidthMm
    }
  }
  if (bestDist <= best + 1) return best
  return fallback
}

function beamInwardAlongClip(
  clip: { start: Point2D; end: Point2D },
  beams: FrameBeamTrimSegment[],
): Point2D | null {
  let bestDist = Infinity
  let best: Point2D | null = null
  for (const beam of beams) {
    if (!segmentsParallel(clip.start, clip.end, beam.start, beam.end)) continue
    const dist = distancePointToInfiniteLine(clip.start, beam.start, beam.end)
    if (dist < bestDist) {
      bestDist = dist
      best = beam.inward
    }
  }
  if (best != null && bestDist <= beamHalfAlongClip(clip, beams) + 1) return best
  return null
}

function beamFaceUnderPoint(
  point: Point2D,
  along: { start: Point2D; end: Point2D },
  beams: FrameBeamTrimSegment[],
): Pick<FrameBeamTrimSegment, 'axisToInnerFaceMm' | 'axisToOuterFaceMm' | 'inward' | 'halfWidthMm'> | null {
  let best: { dist: number; beam: FrameBeamTrimSegment } | null = null
  for (const beam of beams) {
    if (!segmentsParallel(along.start, along.end, beam.start, beam.end)) continue
    const dist = distancePointToInfiniteLine(point, beam.start, beam.end)
    if (dist > 1) continue
    const beamDir = unit(sub(beam.end, beam.start))
    const alongBeam = projectAlong(point, beam.start, beamDir)
    const beamLen = segmentLength(beam.start, beam.end)
    if (alongBeam < -1 || alongBeam > beamLen + 1) continue
    if (best == null || dist < best.dist) best = { dist, beam }
  }
  return best?.beam ?? null
}

/**
 * Measured outers follow the contour's edge order. A CCW copy reverses that order
 * (see `edgeValuesInCcwOrder` for the index rule).
 */
export function measuredOutersForCcwContour(
  contour: Point2D[],
  measured: Array<number | null | undefined> | undefined,
): Array<number | null | undefined> | undefined {
  return edgeValuesInCcwOrder(contour, measured)
}

export function trimDividerAxisSegmentsForFrame(input: {
  start: Point2D
  end: Point2D
  beams: FrameBeamTrimSegment[]
  minLengthMm?: number
  /**
   * Notch centerline. Face insets default to the shelf's plan half each side;
   * outer-contour shelves pass full inward / 0 outward (same rule as frame beams).
   */
  wingShelfClip?: WingShelfTrimClip
  /** U-notch may carry left and right shelves on the same floor line. */
  wingShelfClips?: WingShelfTrimClip[]
  /** Used with measured outers when callers rebuild beam faces; axes stay as given. */
  contour?: Point2D[]
  measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
  layoutVersion?: PurlinClearLayoutVersion
  /** Purlin rows set this. See `trimAxisSegmentToInnerFaces`. */
  ignoreBeamsBehindEnds?: boolean
}): TrimmedDividerAxisSegment[] {
  const { start, end, beams, minLengthMm = MIN_FREE_MM, ignoreBeamsBehindEnds = false } = input
  const clips =
    input.wingShelfClips && input.wingShelfClips.length > 0
      ? input.wingShelfClips
      : input.wingShelfClip
        ? [input.wingShelfClip]
        : []
  const dividerHalf = DIVIDER_PLAN_CLEARANCE_WIDTH_MM / 2

  const inner = trimAxisSegmentToInnerFaces({ start, end, beams, ignoreBeamsBehindEnds })
  if (inner.lengthMm < minLengthMm) return []

  let free = trimDividerSegmentAgainstFrameBeams({
    start: inner.start,
    end: inner.end,
    dividerHalfWidthMm: dividerHalf,
    beams,
  })

  for (const wingShelfClip of clips) {
    // On the beam segment, stop on the beam faces. On the shelf alone
    // (the left wing, where the notch beam has ended), stop on the shelf faces.
    const shelfHalf = wingShelfClip.halfWidthMm ?? beamHalfAlongClip(wingShelfClip, beams)
    const resolved: WingShelfTrimClip = {
      ...wingShelfClip,
      halfWidthMm: shelfHalf,
      axisToInnerFaceMm: wingShelfClip.axisToInnerFaceMm ?? shelfHalf,
      axisToOuterFaceMm: wingShelfClip.axisToOuterFaceMm ?? shelfHalf,
      inward:
        wingShelfClip.inward ??
        beamInwardAlongClip(wingShelfClip, beams) ??
        edgeInwardUnit(wingShelfClip.start, wingShelfClip.end, true),
    }
    const next: Array<{ start: Point2D; end: Point2D }> = []
    for (const part of free) {
      if (segmentRunsAlongWingShelf(part.start, part.end, resolved)) {
        const hit = intersectCollinearSegments(part.start, part.end, resolved.start, resolved.end)
        if (hit) next.push(hit)
        continue
      }
      const split = splitSegmentAcrossSupport(part.start, part.end, resolved, beams)
      if (split) next.push(...split)
      else next.push(part)
    }
    free = next
  }

  return free
    .map((p) => ({
      start: p.start,
      end: p.end,
      lengthAxisMm: segmentLength(p.start, p.end),
    }))
    .filter((p) => p.lengthAxisMm >= minLengthMm)
}

function splitSegmentAcrossSupport(
  start: Point2D,
  end: Point2D,
  support: WingShelfTrimClip,
  beams: FrameBeamTrimSegment[],
): Array<{ start: Point2D; end: Point2D }> | null {
  const dir = unit(sub(end, start))
  const axisLen = segmentLength(start, end)
  if (axisLen < MIN_FREE_MM) return null
  const sDir = unit(sub(support.end, support.start))
  if (Math.abs(dot(dir, sDir)) > PARALLEL_COS) return null
  const tHit = intersectLineSegment(start, dir, support.start, support.end)
  if (tHit == null) return null
  const hit = add(start, scale(dir, tHit))
  const onBeam = beamFaceUnderPoint(hit, support, beams)
  const half = support.halfWidthMm ?? DIVIDER_PLAN_CLEARANCE_WIDTH_MM / 2
  const shelfW = half * 2
  // Keep the shelf's own plan width; only borrow inward + outer/centerline side rule.
  let inner = support.axisToInnerFaceMm ?? half
  let outer = support.axisToOuterFaceMm ?? half
  if (onBeam != null) {
    const beamW = onBeam.halfWidthMm * 2
    const isOuter = onBeam.axisToOuterFaceMm <= 0.5 && onBeam.axisToInnerFaceMm >= beamW - 0.5
    inner = isOuter ? shelfW : half
    outer = shelfW - inner
  }
  const faces = {
    axisToInnerFaceMm: inner,
    axisToOuterFaceMm: outer,
    inward: onBeam?.inward ?? support.inward ?? edgeInwardUnit(support.start, support.end, true),
    halfWidthMm: half,
  }
  // First piece approaches the support opposite to `dir`; second with `dir`.
  const backInset = faceInsetToward(faces, scale(dir, -1))
  const aheadInset = faceInsetToward(faces, dir)
  if (tHit <= backInset || tHit >= axisLen - aheadInset) return null
  const a = add(hit, scale(dir, -backInset))
  const b = add(hit, scale(dir, aheadInset))
  const first = { start, end: a }
  const second = { start: b, end }
  return [first, second].filter((p) => segmentLength(p.start, p.end) >= MIN_FREE_MM)
}

function intersectLineSegment(origin: Point2D, dir: Point2D, a: Point2D, b: Point2D): number | null {
  const dx = dir[0]
  const dy = dir[1]
  const sx = b[0] - a[0]
  const sy = b[1] - a[1]
  const denom = dx * sy - dy * sx
  if (Math.abs(denom) < 1e-12) return null
  const t = ((a[0] - origin[0]) * sy - (a[1] - origin[1]) * sx) / denom
  const s = ((a[0] - origin[0]) * dy - (a[1] - origin[1]) * dx) / denom
  if (s < -1e-9 || s > 1 + 1e-9) return null
  return t
}

export function segmentRunsAlongWingShelf(
  start: Point2D,
  end: Point2D,
  shelf: { start: Point2D; end: Point2D },
): boolean {
  return (
    segmentsParallel(start, end, shelf.start, shelf.end) &&
    distancePointToInfiniteLine(start, shelf.start, shelf.end) <= COLINEAR_DIST_EPS_MM
  )
}

/**
 * A shelf that stops on the notch beam's square end still overlaps a diagonal
 * beam at that corner. Pull that end back to the diagonal inner face.
 * An end within 3° of square is left where the orthogonal trim put it.
 */
function pullEndsToSkewBeamFace(
  span: { start: Point2D; end: Point2D; lengthMm: number },
  beams: FrameBeamTrimSegment[],
): { start: Point2D; end: Point2D; lengthMm: number } {
  const move = (tip: Point2D, other: Point2D): Point2D => {
    const spanLen = segmentLength(tip, other)
    if (spanLen < MIN_FREE_MM) return tip
    const dir = unit(sub(other, tip))
    let bestFace = 0
    for (const beam of beams) {
      const beamLen = segmentLength(beam.start, beam.end)
      if (beamLen < MIN_FREE_MM) continue
      const beamDir = scale(sub(beam.end, beam.start), 1 / beamLen)
      const sinPhi = Math.abs(dir[0] * beamDir[1] - dir[1] * beamDir[0])
      if (sinPhi < Math.sin((0.5 * Math.PI) / 180)) continue
      const miterDeg = Math.asin(Math.min(1, Math.abs(dot(dir, beamDir)))) * (180 / Math.PI)
      if (miterDeg < 15) continue
      const tHit = axisHitOnBeamSegment(tip, dir, beam.start, beam.end)
      if (tHit == null) continue
      const faceMm = faceInsetToward(beam, dir)
      const inset = faceMm / sinPhi
      const reach = inset + beam.halfWidthMm
      if (tHit < -reach || tHit > reach) continue
      const face = tHit + inset
      // Only the few millimetres a square notch-end still overlaps a diagonal
      // face. A 40 mm pull is the other beam at the same corner.
      if (face > bestFace && face < 8 && face < spanLen * 0.5) bestFace = face
    }
    if (bestFace < 1) return tip
    return add(tip, scale(dir, bestFace))
  }
  const start = move(span.start, span.end)
  const end = move(span.end, start)
  return { start, end, lengthMm: segmentLength(start, end) }
}

export function computeWingShelfClearSpan(
  shelfRaw: { start: Point2D; end: Point2D },
  beams: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
  pullSkewFace = false,
  trimOptions?: CollectFrameBeamTrimOptions,
): { start: Point2D; end: Point2D; lengthMm: number } {
  const trimBeams = collectFrameBeamTrimSegments(beams, profiles, trimOptions)
  const trimmed = wingShelfInnerClearSpanFromRaw(shelfRaw, trimBeams)
  return pullSkewFace ? pullEndsToSkewBeamFace(trimmed, trimBeams) : trimmed
}
