/**
 * Single source for plan-editor construction overlay: same outer lengths,
 * angles, and divider geometry as TopPlanSheet / PDF (`buildTopPlanDimensionModel`).
 */

import type { CutPiece, Point2D, ProfileDimensions } from './types'
import type { PlanConstructionParams } from './planDefaults'
import { specFromPlan } from './buildPieces'
import { computeFrame } from './frame'
import {
  buildTopPlanDimensionModel,
  profilePlanWidthMm,
} from './topPlanDimensions'
import { beamPlanWidthForDrawing, contourSideWidthMm, innerFaceClearMm, lamellaRunEndWidthsMm } from './beamPlanWidth'
import { resolvePlanPurlinLines } from './dividerEdits'
import { lamellaDirectionArrows, type LamellaDirectionArrow } from './lamellaZones'
import { buildDividerPickPieces } from './dividerPickPieces'
import { computeWingShelfClearSpan } from './dividerFrameTrim'
import { pieceAxis } from './pieceAxis'
import { sanitizeContour } from './contourSanitize'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from './planDefaults'
import { isRetiredProfileId } from './pergolaProfiles'
import {
  chordInsidePolygonAlongDir,
  findAllConcaveLamellaParallelShelfRaws,
  offsetShelfToNotchFace,
  wingShelfInteriorPostFractions,
} from './wingShelfSpan'
import { isCCW, miterAtVertex } from './miter'
import { longPointOffset } from './lamellas'
import {
  displayOuterLengthMm,
  outerDeltaMmOnContourSideVertexRule,
  treatContourAsClosedForOuterDelta,
} from './planEditorOuterAxis'

const ANGLE_SNAP_DEG = 0.5

function outerExtensionAlongEdgeAtVertex(planWidthMm: number, miterDeg: number): number {
  return longPointOffset(Math.abs(miterDeg), planWidthMm) + planWidthMm / 2
}

/**
 * Stable outer − axis for one contour side.
 * Closed contour: convex +w/2, concave −w/2 per end (plan width of that edge's beam).
 * Open chain: miter-based ends until the contour closes.
 */
export function outerDeltaMmOnContourSide(
  contour: Point2D[],
  edgeIndex: number,
  planWidthMm: number,
  closureGapMm = 0,
  planWidthForEdge?: (edgeIndex: number) => number,
): number {
  const n = contour.length
  if (n < 2 || edgeIndex < 0 || edgeIndex >= n) return 0

  if (treatContourAsClosedForOuterDelta(closureGapMm, n)) {
    return outerDeltaMmOnContourSideVertexRule(contour, edgeIndex, planWidthMm, planWidthForEdge)
  }

  const j = edgeIndex + 1
  if (j >= n) return 0

  let startExt = planWidthMm
  if (edgeIndex > 0) {
    const m = miterAtVertex(contour[edgeIndex - 1], contour[edgeIndex], contour[j])
    startExt = outerExtensionAlongEdgeAtVertex(planWidthMm, m.miterAngleDeg)
  }

  let endExt = planWidthMm
  if (j < n - 1) {
    const m = miterAtVertex(contour[edgeIndex], contour[j], contour[j + 1])
    endExt = outerExtensionAlongEdgeAtVertex(planWidthMm, m.miterAngleDeg)
  }

  return startExt + endExt
}
function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}
function len(a: Point2D): number {
  return Math.hypot(a[0], a[1])
}
function unit(a: Point2D): Point2D {
  const l = len(a)
  return l > 1e-9 ? [a[0] / l, a[1] / l] : [1, 0]
}
function dot(a: Point2D, b: Point2D): number {
  return a[0] * b[0] + a[1] * b[1]
}

export interface PlanEditorSideDimensions {
  edgeId: string
  edgeIndex: number
  axisLengthMm: number
  outerLengthMm: number
  /** outer − axis; independent of axis length (miters + plan widths at ends). */
  outerDeltaMm: number
}

export interface PlanEditorDividerOverlayLine {
  dividerId: string
  start: Point2D
  end: Point2D
  /** True when geometry comes from wing-shelf edge, not span grid offset. */
  isWingShelfSpan?: boolean
  lengthMm?: number
}

export interface PlanEditorOverlayModel {
  sides: PlanEditorSideDimensions[]
  dimensionModel: ReturnType<typeof buildTopPlanDimensionModel>
  geometricSides: Array<{ id: string; start: Point2D; end: Point2D }>
  centroid: Point2D
  dividerLines: PlanEditorDividerOverlayLine[]
  lamellaDirectionDeg: number
  /** One arrow per lamella zone and one for the rest; empty when the plan has no zones. */
  lamellaZoneArrows: LamellaDirectionArrow[]
}

function centroidOf(points: Point2D[]): Point2D {
  if (points.length === 0) return [0, 0]
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

function editorSidesFromContour(
  contour: Point2D[],
  edgeIds?: string[],
): Array<{ id: string; start: Point2D; end: Point2D }> {
  const n = contour.length
  const sides: Array<{ id: string; start: Point2D; end: Point2D }> = []
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    sides.push({
      id: edgeIds?.[i] ?? `edge-${i}`,
      start: contour[i],
      end: contour[j],
    })
  }
  return sides
}

function edgeIsHorizontal(dx: number, dy: number): boolean {
  const angleDeg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI
  return angleDeg <= ANGLE_SNAP_DEG || angleDeg >= 180 - ANGLE_SNAP_DEG
}

function edgeIsVertical(dx: number, dy: number): boolean {
  const angleDeg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI
  return Math.abs(angleDeg - 90) <= ANGLE_SNAP_DEG
}

/** Slack for the chord end against the left frame line (wobbled plans are off by hundredths of a mm). */
const SHELF_CHORD_REACH_TOLERANCE_MM = 1

/**
 * True when the horizontal chord from `corner` to the left frame line lies inside the contour:
 * the longest inside chord going left from the corner ends on the frame line, not on some
 * other edge in front of it.
 */
function chordReachesLeftFrameInside(pts: Point2D[], corner: Point2D, leftOuterX: number): boolean {
  if (corner[0] - leftOuterX < 1) return false
  const chord = chordInsidePolygonAlongDir(pts, corner, [-1, 0])
  if (!chord) return false
  const reachX = Math.min(chord.start[0], chord.end[0])
  return Math.abs(reachX - leftOuterX) <= SHELF_CHORD_REACH_TOLERANCE_MM
}

function shelfMid(seg: { start: Point2D; end: Point2D }): Point2D {
  return [(seg.start[0] + seg.end[0]) / 2, (seg.start[1] + seg.end[1]) / 2]
}

function pushUniqueShelf(
  out: Array<{ start: Point2D; end: Point2D }>,
  seg: { start: Point2D; end: Point2D },
): void {
  const mid = shelfMid(seg)
  const lenMm = Math.hypot(seg.end[0] - seg.start[0], seg.end[1] - seg.start[1])
  if (lenMm < 1) return
  for (const existing of out) {
    const em = shelfMid(existing)
    if (Math.hypot(mid[0] - em[0], mid[1] - em[1]) < 80) return
  }
  out.push({ start: seg.start, end: seg.end })
}

/**
 * All horizontal wing-shelf spans on a notch floor: left wing and, for a U-notch
 * (house), the right wing on the same line. G/L roofs still yield one span.
 */
export function findWingShelfSpanSegments(
  contour: Point2D[],
  lamellaDirectionDeg = DEFAULT_PLAN_CONSTRUCTION_PARAMS.lamellaDirectionDeg,
): Array<{ start: Point2D; end: Point2D }> {
  const clean = sanitizeContour(contour)
  const pts = isCCW(clean) ? clean : [...clean].reverse()
  const n = pts.length
  if (n < 4) return []

  const leftOuterX = Math.min(...pts.map((p) => p[0]))
  const out: Array<{ start: Point2D; end: Point2D }> = []

  // G/L notch-corner: leftward chord only (same rule as before).
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n]
    const v = pts[i]
    const next = pts[(i + 1) % n]
    const eIn = sub(v, prev)
    const eOut = sub(next, v)
    const inVert = edgeIsVertical(eIn[0], eIn[1])
    const outVert = edgeIsVertical(eOut[0], eOut[1])
    const inHoriz = edgeIsHorizontal(eIn[0], eIn[1])
    const outHoriz = edgeIsHorizontal(eOut[0], eOut[1])
    const isNotchCorner = (inVert && !outHoriz && !outVert) || (outVert && !inHoriz && !inVert)
    if (!isNotchCorner) continue
    if (!chordReachesLeftFrameInside(pts, v, leftOuterX)) continue
    const shelfY = v[1]
    pushUniqueShelf(out, { start: [leftOuterX, shelfY], end: [v[0], shelfY] })
  }
  // Keep the classic single-shelf G/L path: do not mix concave extras on top.
  if (out.length > 0) return out

  // U-notch (house): no G/L notch-corner match — take every concave shelf so
  // the right wing is not dropped when it is shorter than the left.
  for (const concave of findAllConcaveLamellaParallelShelfRaws(pts, lamellaDirectionDeg)) {
    pushUniqueShelf(out, { start: concave.start, end: concave.end })
  }

  return out
}

/**
 * Longest horizontal wing-shelf span for G/L roofs: bottom outer beam of the
 * upper wing (notch shelf), extended left to the left outer frame line.
 * Returns null when no such shelf is found. Prefer `findWingShelfSpanSegments`
 * when a U-notch may carry a second shelf on the right.
 */
export function findWingShelfSpanSegment(
  contour: Point2D[],
  lamellaDirectionDeg = DEFAULT_PLAN_CONSTRUCTION_PARAMS.lamellaDirectionDeg,
): { start: Point2D; end: Point2D } | null {
  const all = findWingShelfSpanSegments(contour, lamellaDirectionDeg)
  if (all.length === 0) return null
  let best = all[0]
  let bestLen = Math.hypot(best.end[0] - best.start[0], best.end[1] - best.start[1])
  for (let i = 1; i < all.length; i++) {
    const seg = all[i]
    const lenMm = Math.hypot(seg.end[0] - seg.start[0], seg.end[1] - seg.start[1])
    if (lenMm > bestLen) {
      best = seg
      bestLen = lenMm
    }
  }
  return best
}

export const WING_SHELF_SPAN_DIVIDER_ID = 'wing-shelf-span'
/** Retired 50×30 shelf. Saved plans still resolve the id; it is not a default. */
export const DEFAULT_WING_SHELF_PROFILE_ID = 'purlin-plain-5030'

/** Shown when the span field is empty and a divider is longer than this. */
export const LONG_DIVIDER_WITHOUT_SUPPORT_MM = 4000

/**
 * Empty max-span (off) plus a divider longer than 4000 mm.
 * A saved plan that omits the span is not filled in; this only reports it.
 */
export function hasLongDividerWithoutSupport(
  dividerLengthsMm: number[],
  purlinMaxSpanMm: number | null | undefined,
): boolean {
  if (purlinMaxSpanMm != null && purlinMaxSpanMm > 0) return false
  return dividerLengthsMm.some((length) => length > LONG_DIVIDER_WITHOUT_SUPPORT_MM)
}

export interface WingShelfSupport {
  start: Point2D
  end: Point2D
  lengthMm: number
  postPlanPoints: Point2D[]
  profileId: string
}

/**
 * Measured outer of the contour edge the shelf chord copies.
 * Only an edge whose axis (or typed outer) matches the chord — the 4000
 * notch span, not the 8000 wing beside it.
 */
function shelfParallelOuterMm(
  contour: Point2D[],
  raw: { start: Point2D; end: Point2D },
  measured: Array<number | null | undefined> | undefined,
): number | null {
  if (!measured) return null
  const rawLen = len(sub(raw.end, raw.start))
  const dir = unit(sub(raw.end, raw.start))
  let best: number | null = null
  let bestDelta = 80
  for (let i = 0; i < contour.length; i++) {
    const outer = measured[i]
    if (outer == null || !(outer > 0)) continue
    const a = contour[i]
    const b = contour[(i + 1) % contour.length]
    const edge = sub(b, a)
    const edgeLen = len(edge)
    if (edgeLen < 1) continue
    const along: Point2D = [edge[0] / edgeLen, edge[1] / edgeLen]
    if (Math.abs(dot(along, dir)) < 0.99) continue
    const delta = Math.min(Math.abs(rawLen - outer), Math.abs(rawLen - edgeLen))
    if (delta < bestDelta) {
      bestDelta = delta
      best = outer
    }
  }
  return best
}

/** Plan width of the frame side the shelf end butts into (full beam, not half). */
function shelfEndBeamWidthMm(
  contour: Point2D[],
  point: Point2D,
  shelfDir: Point2D,
  widthAt: (edgeIndex: number) => number,
  fallback: number,
): number {
  let best = fallback
  let bestDist = 80
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % contour.length]
    const edge = sub(b, a)
    const edgeLen = len(edge)
    if (edgeLen < 1) continue
    const along: Point2D = [edge[0] / edgeLen, edge[1] / edgeLen]
    if (Math.abs(dot(along, shelfDir)) > 0.2) continue
    const rel = sub(point, a)
    const dist = Math.abs(rel[0] * along[1] - rel[1] * along[0])
    const alongMm = dot(rel, along)
    if (alongMm < -30 || alongMm > edgeLen + 30) continue
    if (dist < bestDist) {
      bestDist = dist
      best = widthAt(i)
    }
  }
  return best
}

/**
 * When the shelf chord is stored on the outer (typed length = chord), the
 * clear is outer − full beam at each end. A centerline chord is already
 * shorter by half of each beam, so the half-trim equals the same length.
 */
function shelfInnerFaceSpan(
  contour: Point2D[],
  raw: { start: Point2D; end: Point2D },
  faced: { start: Point2D; end: Point2D },
  halfTrimmed: { start: Point2D; end: Point2D; lengthMm: number },
  widthAt: (edgeIndex: number) => number,
  measured: Array<number | null | undefined> | undefined,
  fallbackWidthMm: number,
): { start: Point2D; end: Point2D; lengthMm: number } {
  const rawLen = len(sub(raw.end, raw.start))
  const outer = shelfParallelOuterMm(contour, raw, measured)
  if (outer == null || Math.abs(outer - rawLen) > 1) return halfTrimmed
  const dir = unit(sub(faced.end, faced.start))
  const startW = shelfEndBeamWidthMm(contour, faced.start, dir, widthAt, fallbackWidthMm)
  const endW = shelfEndBeamWidthMm(contour, faced.end, dir, widthAt, fallbackWidthMm)
  const lengthMm = innerFaceClearMm({
    axisLengthMm: rawLen,
    outerLengthMm: outer,
    startWidthMm: startW,
    endWidthMm: endW,
  })
  if (!(lengthMm > 1) || lengthMm >= rawLen) return halfTrimmed
  return {
    start: [faced.start[0] + dir[0] * startW, faced.start[1] + dir[1] * startW],
    end: [faced.end[0] - dir[0] * endW, faced.end[1] - dir[1] * endW],
    lengthMm,
  }
}

function resolveOneWingShelfSupport(
  raw: { start: Point2D; end: Point2D },
  input: {
    contour: Point2D[]
    params: PlanConstructionParams
    profiles: Map<string, ProfileDimensions>
    beams: CutPiece[]
    wallEdgeIndices?: number[]
  },
): WingShelfSupport | null {
  const { contour, params, profiles, beams } = input
  const fallbackWidth = beamPlanWidthForDrawing(profiles, params.beamProfileId).planWidthMm
  // The shelf stays on the notch-beam centerline and occupies that beam's band
  // (the purlin split uses half of DIVIDER_PLAN_CLEARANCE_WIDTH_MM). Shifting it
  // out by half a beam shortened the upper bay by 20 mm and lengthened the lower.
  const faced = offsetShelfToNotchFace(raw, contour, 0)
  const shelfProfileId = params.wingShelfProfileId
  const pullSkewFace = Boolean(shelfProfileId) && !isRetiredProfileId(shelfProfileId)
  const halfTrimmed = computeWingShelfClearSpan(faced, beams, profiles, pullSkewFace, {
    contour,
    measuredOuterLengthMmByEdgeIndex: params.measuredOuterLengthMmByEdgeIndex,
    layoutVersion: params.purlinClearLayoutVersion === 1 ? 1 : undefined,
    contourReference: params.contourReference,
  })
  if (halfTrimmed.lengthMm < 1) return null
  const widthAt = (edgeIndex: number) =>
    contourSideWidthMm(profiles, edgeIndex, {
      wallEdgeIndices: input.wallEdgeIndices,
      beamProfileId: params.beamProfileId,
      wallProfileId: params.wallProfileId,
      wallBeamWidthVersion: params.wallBeamWidthVersion,
    })
  const clear = shelfInnerFaceSpan(
    contour,
    raw,
    faced,
    halfTrimmed,
    widthAt,
    params.measuredOuterLengthMmByEdgeIndex,
    fallbackWidth,
  )
  if (clear.lengthMm < 1) return null

  const maxSpan = params.purlinMaxSpanMm
  const fractions =
    maxSpan != null && maxSpan > 0
      ? wingShelfInteriorPostFractions(clear.lengthMm, params.postMaxSpanMm ?? maxSpan)
      : []
  const dx = clear.end[0] - clear.start[0]
  const dy = clear.end[1] - clear.start[1]
  const postPlanPoints = fractions.map((t): Point2D => [
    clear.start[0] + dx * t,
    clear.start[1] + dy * t,
  ])
  const chosenShelf = params.wingShelfProfileId
  const profileId = chosenShelf && profiles.has(chosenShelf) ? chosenShelf : ''
  return {
    start: clear.start,
    end: clear.end,
    lengthMm: clear.lengthMm,
    postPlanPoints,
    profileId,
  }
}

/**
 * Auto supports when a divider's free span exceeds `purlinMaxSpanMm`.
 * A U-notch yields left and right shelves on the same floor line; G/L yields one.
 * Unset max span on saved plans ⇒ never insert (legacy).
 */
export function resolveAllWingShelfSupports(input: {
  contour: Point2D[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  beams: CutPiece[]
  wallEdgeIndices?: number[]
}): WingShelfSupport[] {
  const { contour, params, profiles } = input
  const maxSpan = params.purlinMaxSpanMm
  if (maxSpan == null || !(maxSpan > 0)) return []

  const raws = findWingShelfSpanSegments(contour, params.lamellaDirectionDeg)
  if (raws.length === 0) return []

  const pickPieces = buildDividerPickPieces(contour, params, profiles)
  let maxFree = 0
  for (const piece of pickPieces) {
    if (piece.dividerId === WING_SHELF_SPAN_DIVIDER_ID) continue
    const { start, end } = pieceAxis(piece)
    const lenMm = Math.hypot(end[0] - start[0], end[1] - start[1])
    if (lenMm > maxFree) maxFree = lenMm
  }
  if (maxFree <= maxSpan) return []

  const out: WingShelfSupport[] = []
  for (const raw of raws) {
    const support = resolveOneWingShelfSupport(raw, input)
    if (support) out.push(support)
  }
  return out
}

/**
 * Primary (longest) auto wing-shelf support. Prefer `resolveAllWingShelfSupports`
 * when a U-notch may carry a second shelf on the right.
 */
export function resolveWingShelfSupport(input: {
  contour: Point2D[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  beams: CutPiece[]
  wallEdgeIndices?: number[]
}): WingShelfSupport | null {
  const all = resolveAllWingShelfSupports(input)
  if (all.length === 0) return null
  let best = all[0]
  for (let i = 1; i < all.length; i++) {
    if (all[i].lengthMm > best.lengthMm) best = all[i]
  }
  return best
}

export function buildPlanEditorOverlayModel(input: {
  contour: Point2D[]
  wallEdgeIndices: number[]
  params: PlanConstructionParams
  profiles: Map<string, ProfileDimensions>
  /** Same order as contour edges in the plan editor (`fixedEdges`). */
  edgeIds?: string[]
  /** When > ~0.5 mm, outer deltas ignore polygon wrap (open chain in plan editor). */
  contourClosureGapMm?: number
  /** Edge direction in degrees, same order as `contour`. A mismatch hides corner labels. */
  edgeHeadingDeg?: number[]
  /** Site measurements — overlay labels must show these, never axis + extension. */
  measuredOuterLengthMmByEdgeId?: Map<string, number>
}): PlanEditorOverlayModel | null {
  const { contour, wallEdgeIndices, params, profiles, edgeIds, contourClosureGapMm = 0, measuredOuterLengthMmByEdgeId, edgeHeadingDeg } = input
  if (contour.length < 3) return null

  const spec = specFromPlan({ contour, wallEdgeIndices, params })
  const frame = computeFrame(spec, profiles)
  const beams = frame.beams
  const editorSides = editorSidesFromContour(contour, edgeIds)
  const contourClosed = treatContourAsClosedForOuterDelta(contourClosureGapMm, contour.length)
  const measuredByIndex = editorSides.map((side) => measuredOuterLengthMmByEdgeId?.get(side.id) ?? null)
  const hasMeasured = measuredByIndex.some((v) => v != null)
  const fromParams = params.measuredOuterLengthMmByEdgeIndex
  const measuredOuterLengthMmByEdgeIndex = hasMeasured ? measuredByIndex : fromParams

  const centroid = centroidOf(contour)
  const dividerPositions = resolvePlanPurlinLines(contour, params, profiles, wallEdgeIndices, { overhangDividers: true })
  const sideWidthInput = {
    wallEdgeIndices,
    beamProfileId: params.beamProfileId,
    wallProfileId: params.wallProfileId,
    wallBeamWidthVersion: params.wallBeamWidthVersion,
  }
  const widthAt = (edgeIndex: number) => contourSideWidthMm(profiles, edgeIndex, sideWidthInput)
  const endWidths = lamellaRunEndWidthsMm(contour, params.lamellaDirectionDeg, profiles, sideWidthInput)
  const perSideWidths = params.wallBeamWidthVersion === 1
  const dimensionModel = buildTopPlanDimensionModel({
    geometricSides: editorSides,
    beams,
    profiles,
    beamProfileId: params.beamProfileId,
    centroid,
    contourVertices: contour,
    lamellaDirectionDeg: params.lamellaDirectionDeg,
    dividerPositions,
    purlinDividerMode: params.purlinDividers?.mode,
    measuredOuterLengthMmByEdgeIndex,
    contourIsClosed: contourClosed,
    purlinClearLayoutVersion: params.purlinClearLayoutVersion,
    edgeHeadingDeg,
    suppressVertexAngles: contourClosureGapMm > 1,
    ...(perSideWidths
      ? {
          leftEndWidthMm: endWidths.leftMm,
          rightEndWidthMm: endWidths.rightMm,
          planWidthForContourEdge: widthAt,
        }
      : {}),
  })

  const sides: PlanEditorSideDimensions[] = editorSides.map((side, edgeIndex) => {
    const axisLengthMm = len(sub(side.end, side.start))
    const beamWidth = profilePlanWidthMm(profiles, params.beamProfileId)
    const outerDeltaMm = contourClosed
      ? outerDeltaMmOnContourSide(contour, edgeIndex, beamWidth, contourClosureGapMm, widthAt)
      : 0
    const labelMm = dimensionModel.perimeterChains[edgeIndex]?.segmentsMm[0]
    const computedOuterMm = displayOuterLengthMm(axisLengthMm, outerDeltaMm)
    return {
      edgeId: side.id,
      edgeIndex,
      axisLengthMm,
      outerLengthMm: labelMm ?? computedOuterMm,
      outerDeltaMm,
    }
  })

  const supports = resolveAllWingShelfSupports({ contour, params, profiles, beams, wallEdgeIndices })
  const wingShelfClips = supports.map((support) => ({
    start: support.start,
    end: support.end,
    halfWidthMm: beamPlanWidthForDrawing(profiles, support.profileId).planWidthMm / 2,
  }))
  const pickPieces = buildDividerPickPieces(contour, params, profiles, {
    wingShelfClips: wingShelfClips.length > 0 ? wingShelfClips : undefined,
    wingShelfClip: wingShelfClips[0],
    wallEdgeIndices,
    overhangDividers: true,
  })
  const dividerLines: PlanEditorDividerOverlayLine[] = []
  for (const piece of pickPieces) {
    if (!piece.dividerId) continue
    const { start, end } = pieceAxis(piece)
    dividerLines.push({ dividerId: piece.dividerId, start, end })
  }

  for (const support of supports) {
    dividerLines.push({
      dividerId: WING_SHELF_SPAN_DIVIDER_ID,
      start: support.start,
      end: support.end,
      isWingShelfSpan: true,
      lengthMm: support.lengthMm,
    })
  }

  return {
    sides,
    dimensionModel,
    geometricSides: editorSides,
    centroid,
    dividerLines,
    lamellaDirectionDeg: params.lamellaDirectionDeg,
    lamellaZoneArrows:
      params.lamellaZones != null && params.lamellaZones.length > 0
        ? lamellaDirectionArrows(contour, params.lamellaZones, params.lamellaDirectionDeg)
        : [],
  }
}

export function outerLengthToAxisLengthMm(outerMm: number, outerDeltaMm: number): number {
  return outerMm - Math.max(0, outerDeltaMm)
}
