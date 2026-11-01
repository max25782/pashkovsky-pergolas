import {
  beamPlanWidthForDrawing,
  DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
} from './beamPlanWidth'
import type { CutPiece, Point2D, ProfileDimensions, PurlinDividerMode } from './types'
import { computeContourMiters, isCCW, miterAtVertex } from './miter'
import { pieceAxis } from './pieceAxis'
import type { AxialDimensionChain, AxialDimensionPoint, AxialEdgeRef } from './dimensionChains'
import {
  computeEqualPurlinClearMm,
  computeMaxEqualPurlinClearGapMm,
  formatPurlinClearLabelMm,
  isPurlinClearLayoutV1,
  resolvePurlinEndInsetMm,
} from './lamellaSpans'
import type { PurlinClearLayoutVersion, ResolvedPurlinPosition } from './lamellaSpans'

export {
  computeEqualPurlinClearMm,
  computeMaxEqualPurlinClearGapMm,
  dividerPositionsForMaxEqualClears,
  formatPurlinClearLabelMm,
  PURLIN_CLEAR_LAYOUT_VERSION,
} from './lamellaSpans'

/** @deprecated Use `DIVIDER_PLAN_CLEARANCE_WIDTH_MM` from `beamPlanWidth.ts`. */
export const PURLIN_DIVIDER_CLEARANCE_WIDTH_MM = DIVIDER_PLAN_CLEARANCE_WIDTH_MM

const COLINEAR_EPS_MM = 5
const CONSISTENCY_TOLERANCE_MM = 1
/** Collapse to `×N` only when every section matches within 0.5 mm. */
const PURLIN_CLEAR_LABEL_UNIFORM_TOLERANCE_MM = 0.5

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
function len(a: Point2D): number {
  return Math.hypot(a[0], a[1])
}
function unit(a: Point2D): Point2D {
  const l = len(a)
  return l > 1e-9 ? scale(a, 1 / l) : [1, 0]
}

export interface VertexInteriorAngle {
  vertexIndex: number
  vertex: Point2D
  /** Interior angle in degrees, rounded to 0.1° for display only. */
  interiorAngleDeg: number
}

/** Display rounding — no silent snap to 90°. */
export function formatInteriorAngleDeg(deg: number): number {
  return Math.round(deg * 10) / 10
}

/** Frame beam plan width for dimension chains (`planWidthMm` on profile). */
export function profilePlanWidthMm(
  profiles: Map<string, ProfileDimensions>,
  profileId: string,
): number {
  return beamPlanWidthForDrawing(profiles, profileId).planWidthMm
}

/** Shown instead of a corner label when the typed sides do not meet the contour. */
export const ANGLE_CLOSURE_WARNING = 'углы не сходятся с контуром — угол не показан'

/**
 * Interior angle at `vertex`, same geometry as the miter cut (`miterAtVertex`).
 * No snap to 90°. The turn of the two edge directions is not the interior:
 * at a skew corner those differ, and the errors do not belong on the plan.
 */
export function interiorAngleDegAtVertex(prev: Point2D, vertex: Point2D, next: Point2D): number {
  return miterAtVertex(prev, vertex, next, { rightAngleSnapDeg: 0 }).interiorAngleDeg
}

/** Interior between two edge headings, degrees. Incoming is the edge that arrives. */
export function interiorAngleFromHeadingsDeg(incomingDeg: number, outgoingDeg: number): number {
  let turn = outgoingDeg - incomingDeg
  while (turn <= -180) turn += 360
  while (turn > 180) turn -= 360
  let interior = 180 - turn
  while (interior < 0) interior += 360
  while (interior >= 360) interior -= 360
  return interior
}

export function expectedInteriorAngleSumDeg(vertexCount: number): number {
  return (vertexCount - 2) * 180
}

/**
 * Interior angles of the contour. Empty, with a warning, when the polygon
 * sum is not (n−2)×180° or the typed edge headings disagree with the vertices.
 * A heading the closure magnet invented is not drawn.
 */
export function vertexAnglesForContour(
  contour: Point2D[],
  options?: { edgeHeadingDeg?: number[]; suppress?: boolean },
): { angles: VertexInteriorAngle[]; warning: string | null } {
  if (contour.length < 3) return { angles: [], warning: null }
  if (options?.suppress) return { angles: [], warning: ANGLE_CLOSURE_WARNING }
  const n = contour.length
  const ccw = isCCW(contour)
  const miters = computeContourMiters(contour, { rightAngleSnapDeg: 0 })
  const angles: VertexInteriorAngle[] = contour.map((vertex, i) => {
    const miter = miters[ccw ? i : (n - 1 - i)]
    return {
      vertexIndex: i,
      vertex,
      interiorAngleDeg: formatInteriorAngleDeg(miter.interiorAngleDeg),
    }
  })
  const sum = angles.reduce((total, entry) => total + entry.interiorAngleDeg, 0)
  if (Math.abs(sum - expectedInteriorAngleSumDeg(n)) > 0.5) {
    return { angles: [], warning: ANGLE_CLOSURE_WARNING }
  }
  const headings = options?.edgeHeadingDeg
  if (headings && headings.length === n) {
    for (let i = 0; i < n; i++) {
      const fromHeading = interiorAngleFromHeadingsDeg(headings[(i + n - 1) % n], headings[i])
      const delta = Math.abs(fromHeading - angles[i].interiorAngleDeg)
      if (Math.min(delta, 360 - delta) > 1) {
        return { angles: [], warning: ANGLE_CLOSURE_WARNING }
      }
    }
  }
  return { angles, warning: null }
}

export function buildVertexInteriorAngles(contour: Point2D[]): VertexInteriorAngle[] {
  return vertexAnglesForContour(contour).angles
}

function outwardNormal(edgeStart: Point2D, edgeEnd: Point2D, centroid: Point2D): Point2D {
  const dir = unit(sub(edgeEnd, edgeStart))
  const candidate: Point2D = [-dir[1], dir[0]]
  const mid: Point2D = [(edgeStart[0] + edgeEnd[0]) / 2, (edgeStart[1] + edgeEnd[1]) / 2]
  const towardCentroid = dot(sub(centroid, mid), candidate)
  return towardCentroid > 0 ? scale(candidate, -1) : candidate
}

function pointOnSideAxis(side: AxialEdgeRef, tMm: number): boolean {
  return tMm >= -COLINEAR_EPS_MM && tMm <= len(sub(side.end, side.start)) + COLINEAR_EPS_MM
}

function axisOnSideLine(p: Point2D, side: AxialEdgeRef): boolean {
  const dir = unit(sub(side.end, side.start))
  const perp: Point2D = [-dir[1], dir[0]]
  const rel = sub(p, side.start)
  const t = dot(rel, dir)
  const off = Math.abs(dot(rel, perp))
  return off <= COLINEAR_EPS_MM && pointOnSideAxis(side, t)
}

function beamOnGeometricSide(beam: CutPiece, side: AxialEdgeRef): boolean {
  const { start, end } = pieceAxis(beam)
  return axisOnSideLine(start, side) && axisOnSideLine(end, side)
}

function intersectLines(p: Point2D, d: Point2D, q: Point2D, e: Point2D): Point2D | null {
  const den = d[0] * e[1] - d[1] * e[0]
  if (Math.abs(den) < 1e-9) return null
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den
  return add(p, scale(d, t))
}

/** Right of travel when the contour is CCW. Correct for a concave edge, where the centroid can sit on the outside. */
export function contourEdgeOutward(contour: Point2D[], edgeIndex: number): Point2D {
  const n = contour.length
  const a = contour[edgeIndex]
  const b = contour[(edgeIndex + 1) % n]
  const dir = unit(sub(b, a))
  const left: Point2D = [-dir[1], dir[0]]
  return isCCW(contour) ? scale(left, -1) : left
}

/** Outer corner: intersection of the two offset faces at a contour vertex. */
export function outerVertexAtContourIndex(
  contour: Point2D[],
  vertexIndex: number,
  halfWidthIncomingMm: number,
  halfWidthOutgoingMm: number,
): Point2D {
  const n = contour.length
  const prevI = (vertexIndex + n - 1) % n
  const v = contour[vertexIndex]
  const dirIn = unit(sub(v, contour[prevI]))
  const dirOut = unit(sub(contour[(vertexIndex + 1) % n], v))
  const pIn = add(v, scale(contourEdgeOutward(contour, prevI), halfWidthIncomingMm))
  const pOut = add(v, scale(contourEdgeOutward(contour, vertexIndex), halfWidthOutgoingMm))
  return intersectLines(pIn, dirIn, pOut, dirOut) ?? add(v, scale(contourEdgeOutward(contour, vertexIndex), halfWidthOutgoingMm))
}

export function matchContourEdgeIndex(side: AxialEdgeRef, contour: Point2D[]): number {
  const n = contour.length
  if (n < 2) return -1
  const dir = unit(sub(side.end, side.start))
  const mid: Point2D = [(side.start[0] + side.end[0]) / 2, (side.start[1] + side.end[1]) / 2]
  let best = -1
  let bestScore = Infinity
  for (let i = 0; i < n; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    const eDir = unit(sub(b, a))
    if (Math.abs(dot(dir, eDir)) < 0.92) continue
    const rel = sub(mid, a)
    const off = Math.abs(rel[0] * eDir[1] - rel[1] * eDir[0])
    const t = dot(rel, eDir)
    const eLen = len(sub(b, a))
    if (t < -COLINEAR_EPS_MM || t > eLen + COLINEAR_EPS_MM) continue
    if (off < bestScore) {
      bestScore = off
      best = i
    }
  }
  return best
}

function adjacentBeamAtVertex(
  vertex: Point2D,
  sideDir: Point2D,
  beams: CutPiece[],
  skip: Set<string>,
  profileForBeam: (beam: CutPiece) => number,
): { dir: Point2D; widthMm: number } | null {
  for (const beam of beams) {
    if (skip.has(beam.id)) continue
    const { start, end } = pieceAxis(beam)
    const atStart = len(sub(start, vertex)) <= COLINEAR_EPS_MM
    const atEnd = len(sub(end, vertex)) <= COLINEAR_EPS_MM
    if (!atStart && !atEnd) continue
    const other = atStart ? end : start
    const dir = unit(sub(other, vertex))
    if (Math.abs(dot(dir, sideDir)) > 0.95) continue
    return { dir, widthMm: profileForBeam(beam) }
  }
  return null
}

function offsetFacePointAtVertex(
  vertex: Point2D,
  thisDir: Point2D,
  thisOutward: Point2D,
  thisHalfW: number,
  adj: { dir: Point2D; widthMm: number } | null,
  centroid: Point2D,
): Point2D {
  const pThis = add(vertex, scale(thisOutward, thisHalfW))
  if (!adj) return pThis
  const adjEnd = add(vertex, adj.dir)
  const adjOut = outwardNormal(vertex, adjEnd, centroid)
  const pAdj = add(vertex, scale(adjOut, adj.widthMm / 2))
  return intersectLines(pThis, thisDir, pAdj, adj.dir) ?? pThis
}

/**
 * Outer-face extent of one geometric side: offset-face intersection at each
 * end (convex +w_adj/2, concave −w_adj/2, oblique via the same intersection).
 * Does not add miter long-point on top of half-width, and does not project
 * the beam rectangle past that intersection.
 */
export function outerFaceLengthOnSide(
  side: AxialEdgeRef,
  beams: CutPiece[],
  beamWidthMm: number,
  centroid: Point2D,
  profileForBeam: (beam: CutPiece) => number,
): { outerStart: Point2D; outerEnd: Point2D; lengthMm: number } {
  const dir = unit(sub(side.end, side.start))
  const outward = outwardNormal(side.start, side.end, centroid)
  const sideBeams = beams.filter((b) => beamOnGeometricSide(b, side))
  const skip = new Set(sideBeams.map((b) => b.id))
  const w =
    sideBeams.length > 0
      ? profileForBeam(sideBeams[0]) ?? beamWidthMm
      : beamWidthMm
  const adjStart = adjacentBeamAtVertex(side.start, dir, beams, skip, profileForBeam)
  const adjEnd = adjacentBeamAtVertex(side.end, scale(dir, -1), beams, skip, profileForBeam)
  const outerStart = offsetFacePointAtVertex(side.start, dir, outward, w / 2, adjStart, centroid)
  const outerEnd = offsetFacePointAtVertex(side.end, dir, outward, w / 2, adjEnd, centroid)
  return { outerStart, outerEnd, lengthMm: len(sub(outerEnd, outerStart)) }
}

/**
 * One perimeter dimension chain per geometric side — single segment, outer face.
 */
export function buildOuterPerimeterDimensionChains(
  sides: AxialEdgeRef[],
  beams: CutPiece[],
  beamWidthMm: number,
  centroid: Point2D,
  profileWidthForBeam: (beam: CutPiece) => number = () => beamWidthMm,
  options?: {
    contourVertices?: Point2D[]
    contourIsClosed?: boolean
    measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
    planWidthForContourEdge?: (edgeIndex: number) => number
  },
): AxialDimensionChain[] {
  const contour = options?.contourVertices
  const closed = options?.contourIsClosed !== false
  const measured = options?.measuredOuterLengthMmByEdgeIndex
  const widthAt = options?.planWidthForContourEdge ?? (() => beamWidthMm)

  let contourOuters: { vertices: Point2D[]; lengths: number[] } | null = null
  if (contour && contour.length >= 3 && closed) {
    const n = contour.length
    const vertices: Point2D[] = []
    for (let i = 0; i < n; i++) {
      const prev = (i + n - 1) % n
      vertices.push(outerVertexAtContourIndex(contour, i, widthAt(prev) / 2, widthAt(i) / 2))
    }
    contourOuters = {
      vertices,
      lengths: vertices.map((v, i) => len(sub(vertices[(i + 1) % n], v))),
    }
  }

  return sides.map((side, edgeIndex) => {
    const contourIdx = contour && contourOuters ? matchContourEdgeIndex(side, contour) : -1
    const computed =
      contourIdx >= 0 && contourOuters && contour
        ? {
            outerStart: contourOuters.vertices[contourIdx],
            outerEnd: contourOuters.vertices[(contourIdx + 1) % contour.length],
            lengthMm: contourOuters.lengths[contourIdx],
          }
        : outerFaceLengthOnSide(side, beams, beamWidthMm, centroid, profileWidthForBeam)
    const measuredIdx = contourIdx >= 0 ? contourIdx : edgeIndex
    const measuredMm = measured?.[measuredIdx]
    const labelMm =
      measuredMm != null && Number.isFinite(measuredMm) ? measuredMm : computed.lengthMm
    const points: AxialDimensionPoint[] = [
      { distanceFromStartMm: 0, point: computed.outerStart, kind: 'corner' },
      { distanceFromStartMm: labelMm, point: computed.outerEnd, kind: 'corner' },
    ]
    return {
      edgeIndex,
      beamId: side.id,
      points,
      segmentsMm: [labelMm],
    }
  })
}

function lamellaUnitVector(lamellaDirectionDeg: number): Point2D {
  const θ = (lamellaDirectionDeg * Math.PI) / 180
  return [Math.cos(θ), Math.sin(θ)]
}

function pointOnSideAtLamellaProjection(
  side: AxialEdgeRef,
  lamellaDirectionDeg: number,
  tMm: number,
): Point2D {
  const L = lamellaUnitVector(lamellaDirectionDeg)
  const dir = unit(sub(side.end, side.start))
  const denom = dot(dir, L)
  if (Math.abs(denom) < 0.01) {
    return [(side.start[0] + side.end[0]) / 2, (side.start[1] + side.end[1]) / 2]
  }
  const alpha = (tMm - dot(side.start, L)) / denom
  return add(side.start, scale(dir, alpha))
}

function lamellaProjectionMm(p: Point2D, lamellaDirectionDeg: number): number {
  const L = lamellaUnitVector(lamellaDirectionDeg)
  return dot(p, L)
}

function pickPrimaryLamellaParallelSide(input: {
  sides: AxialEdgeRef[]
  perimeterChains: AxialDimensionChain[]
  lamellaDirectionDeg: number
  dividerPositions: ResolvedPurlinPosition[]
  beamWidthMm: number
  endInsetMm?: number
}): {
  side: AxialEdgeRef
  edgeIndex: number
  outerLengthMm: number
  sideMin: number
  sideMax: number
  dividersOnSide: ResolvedPurlinPosition[]
} | null {
  const { sides, perimeterChains, lamellaDirectionDeg, dividerPositions, beamWidthMm } = input
  const endInsetMm = input.endInsetMm ?? beamWidthMm
  const L = lamellaUnitVector(lamellaDirectionDeg)
  let best: ReturnType<typeof pickPrimaryLamellaParallelSide> = null

  for (let edgeIndex = 0; edgeIndex < sides.length; edgeIndex++) {
    const side = sides[edgeIndex]
    const sideDir = unit(sub(side.end, side.start))
    if (Math.abs(dot(sideDir, L)) <= 0.98) continue
    const outerLengthMm = perimeterChains[edgeIndex]?.segmentsMm[0]
    if (outerLengthMm == null || !(outerLengthMm > 0)) continue

    const t0 = lamellaProjectionMm(side.start, lamellaDirectionDeg)
    const t1 = lamellaProjectionMm(side.end, lamellaDirectionDeg)
    const sideMin = Math.min(t0, t1)
    const sideMax = Math.max(t0, t1)

    const dividersOnSide = dividerPositions
      .filter((d) => d.positionMm > sideMin + endInsetMm && d.positionMm < sideMax - endInsetMm)
      .sort((a, b) => a.positionMm - b.positionMm)

    if (dividersOnSide.length === 0) continue

    const score = dividersOnSide.length * 1_000_000 + outerLengthMm
    const bestScore = best ? best.dividersOnSide.length * 1_000_000 + best.outerLengthMm : -1
    if (score > bestScore) {
      best = { side, edgeIndex, outerLengthMm, sideMin, sideMax, dividersOnSide }
    }
  }
  return best
}

export interface MaxPurlinClearGapVerification {
  dividerCount: number
  outerLengthMm: number
  endBeamPlanWidthMm: number
  expectedEqualClearMm: number
  actualGapsMm: number[]
  /** All section clears within tolerance of each other. */
  gapsAreUniform: boolean
  maxGapSpreadMm: number
  /** Each actual gap within tolerance of Max formula (when uniform). */
  matchesMaxFormula: boolean
}

export function verifyPurlinClearsAgainstMaxRule(input: {
  gapsMm: number[]
  outerLengthMm: number
  endBeamPlanWidthMm: number
  dividerWidthMm?: number
  toleranceMm?: number
}): MaxPurlinClearGapVerification | null {
  const { gapsMm, outerLengthMm, endBeamPlanWidthMm, toleranceMm = CONSISTENCY_TOLERANCE_MM } = input
  const dividerWidthMm = input.dividerWidthMm ?? DIVIDER_PLAN_CLEARANCE_WIDTH_MM
  if (gapsMm.length === 0) return null
  const dividerCount = gapsMm.length - 1
  const expectedEqualClearMm = computeMaxEqualPurlinClearGapMm(
    outerLengthMm,
    endBeamPlanWidthMm,
    dividerCount,
    dividerWidthMm,
  )
  const minGap = Math.min(...gapsMm)
  const maxGap = Math.max(...gapsMm)
  const maxGapSpreadMm = maxGap - minGap
  const gapsAreUniform = maxGapSpreadMm <= toleranceMm
  const matchesMaxFormula = gapsMm.every((g) => Math.abs(g - expectedEqualClearMm) <= toleranceMm)
  return {
    dividerCount,
    outerLengthMm,
    endBeamPlanWidthMm,
    expectedEqualClearMm,
    actualGapsMm: gapsMm,
    gapsAreUniform,
    maxGapSpreadMm,
    matchesMaxFormula,
  }
}

/**
 * Clear openings between inner frame faces and purlin divider axes, along
 * the lamella direction (absolute coordinates, same as `positionMm` on dividers).
 */
export function computePurlinClearGapsMm(input: {
  rangeMinMm: number
  rangeMaxMm: number
  beamWidthMm: number
  dividerWidthMm: number
  dividerPositions: ResolvedPurlinPosition[]
  /** Distance from axis end to inner face. Default = full beam width (legacy). */
  endInsetMm?: number
}): number[] {
  const { rangeMinMm, rangeMaxMm, beamWidthMm, dividerWidthMm, dividerPositions } = input
  const endInsetMm = input.endInsetMm ?? beamWidthMm
  const innerStart = rangeMinMm + endInsetMm
  const innerEnd = rangeMaxMm - endInsetMm
  const positions = dividerPositions.map((d) => d.positionMm).sort((a, b) => a - b)
  const gaps: number[] = []

  if (positions.length === 0) return gaps

  gaps.push(positions[0] - innerStart - dividerWidthMm / 2)
  for (let i = 0; i + 1 < positions.length; i++) {
    gaps.push(positions[i + 1] - positions[i] - dividerWidthMm)
  }
  gaps.push(innerEnd - positions[positions.length - 1] - dividerWidthMm / 2)
  return gaps
}

export function buildPurlinClearDimensionChain(input: {
  geometricSides: AxialEdgeRef[]
  perimeterChains: AxialDimensionChain[]
  lamellaDirectionDeg: number
  beamWidthMm: number
  dividerWidthMm: number
  dividerPositions: ResolvedPurlinPosition[]
  centroid: Point2D
  /** Offset index for parallel dimension lines (0 = closest to contour). */
  chainIndex?: number
  endInsetMm?: number
}): AxialDimensionChain | null {
  const {
    geometricSides,
    perimeterChains,
    lamellaDirectionDeg,
    beamWidthMm,
    dividerWidthMm,
    dividerPositions,
    centroid,
    chainIndex = 0,
    endInsetMm = beamWidthMm,
  } = input
  if (dividerPositions.length === 0) return null

  const primary = pickPrimaryLamellaParallelSide({
    sides: geometricSides,
    perimeterChains,
    lamellaDirectionDeg,
    dividerPositions,
    beamWidthMm,
    endInsetMm,
  })
  if (!primary) return null

  const { side, sideMin, sideMax, dividersOnSide: positions } = primary
  const innerStart = sideMin + endInsetMm
  const innerEnd = sideMax - endInsetMm
  const gaps = computePurlinClearGapsMm({
    rangeMinMm: sideMin,
    rangeMaxMm: sideMax,
    beamWidthMm,
    dividerWidthMm,
    dividerPositions: positions,
    endInsetMm,
  })

  const tickCoords = [innerStart, ...positions.map((p) => p.positionMm), innerEnd]
  const outward = outwardNormal(side.start, side.end, centroid)
  const offsetMm = 450 + chainIndex * 280

  const points: AxialDimensionPoint[] = [
    {
      distanceFromStartMm: 0,
      point: add(
        pointOnSideAtLamellaProjection(side, lamellaDirectionDeg, tickCoords[0]),
        scale(outward, offsetMm),
      ),
      kind: 'corner',
    },
  ]
  let alongMm = 0
  for (let i = 0; i < gaps.length; i++) {
    alongMm += gaps[i]
    const tickIndex = i + 1
    points.push({
      distanceFromStartMm: alongMm,
      point: add(
        pointOnSideAtLamellaProjection(side, lamellaDirectionDeg, tickCoords[tickIndex]),
        scale(outward, offsetMm),
      ),
      kind: tickIndex === tickCoords.length - 1 ? 'corner' : 'post',
      postId: tickIndex < tickCoords.length - 1 ? positions[tickIndex - 1]?.id : undefined,
    })
  }

  return {
    edgeIndex: 1000 + chainIndex,
    beamId: 'purlin-clear-chain',
    points,
    segmentsMm: gaps,
  }
}

export interface SideClearConsistencyResult {
  edgeIndex: number
  outerLengthMm: number
  sumClearsMm: number
  dividerCount: number
  expectedMm: number
  deltaMm: number
  ok: boolean
}

/**
 * On each side parallel to the lamella axis, check:
 * sum(clears) + n×dividerWidth ≈ inner span between frame inner faces on that side.
 */
export function verifyPurlinClearSpanConsistency(input: {
  sides: AxialEdgeRef[]
  beams: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  perimeterChains: AxialDimensionChain[]
  lamellaDirectionDeg: number
  beamWidthMm: number
  dividerWidthMm: number
  dividerPositions: ResolvedPurlinPosition[]
  toleranceMm?: number
}): SideClearConsistencyResult[] {
  const {
    sides,
    beams,
    profiles,
    perimeterChains,
    lamellaDirectionDeg,
    beamWidthMm,
    dividerWidthMm,
    dividerPositions,
    toleranceMm = CONSISTENCY_TOLERANCE_MM,
  } = input
  const L = lamellaUnitVector(lamellaDirectionDeg)
  const results: SideClearConsistencyResult[] = []

  for (let edgeIndex = 0; edgeIndex < sides.length; edgeIndex++) {
    const side = sides[edgeIndex]
    const sideDir = unit(sub(side.end, side.start))
    const parallel = Math.abs(dot(sideDir, L)) > 0.98
    if (!parallel) continue

    const t0 = dot(side.start, L)
    const t1 = dot(side.end, L)
    const sideMin = Math.min(t0, t1)
    const sideMax = Math.max(t0, t1)

    const divsOnSide = dividerPositions
      .filter((d) => d.positionMm > sideMin + beamWidthMm && d.positionMm < sideMax - beamWidthMm)
      .sort((a, b) => a.positionMm - b.positionMm)

    if (divsOnSide.length === 0) continue

    const innerStart = sideMin + beamWidthMm
    const innerEnd = sideMax - beamWidthMm
    const gaps = computePurlinClearGapsMm({
      rangeMinMm: sideMin,
      rangeMaxMm: sideMax,
      beamWidthMm,
      dividerWidthMm,
      dividerPositions: divsOnSide,
    })
    const sumClears = gaps.reduce((a, b) => a + b, 0)
    const outerLengthMm = perimeterChains[edgeIndex]?.segmentsMm[0] ?? 0
    const innerSpanMm = innerEnd - innerStart
    const expectedInnerMm = sumClears + divsOnSide.length * dividerWidthMm
    const deltaMm = innerSpanMm - expectedInnerMm
    results.push({
      edgeIndex,
      outerLengthMm,
      sumClearsMm: sumClears,
      dividerCount: divsOnSide.length,
      expectedMm: expectedInnerMm,
      deltaMm,
      ok: Math.abs(deltaMm) <= toleranceMm,
    })
  }
  return results
}

export interface PurlinClearDisplaySummary {
  /** Unrounded clear (formula). Format with `formatPurlinClearLabelMm`. */
  sectionClearMm: number
  /** One-decimal label, e.g. `1288.9`. */
  sectionClearLabel: string
  /** Number of equal (or nearly equal) sections on the primary run. */
  sectionCount: number
}

export interface TopPlanDimensionModel {
  perimeterChains: AxialDimensionChain[]
  purlinClearChain: AxialDimensionChain | null
  /** When a purlin clear chain exists, compare actual section gaps to Max rule on the lamella-parallel side. */
  purlinClearVerification: MaxPurlinClearGapVerification | null
  /** When all sections match within 1 mm, UI shows one repeated value instead of many labels. */
  purlinClearDisplaySummary: PurlinClearDisplaySummary | null
  vertexAngles: VertexInteriorAngle[]
  /** Set when corner labels are omitted because the sides and angles do not close. */
  angleClosureWarning?: string | null
}

export function buildTopPlanDimensionModel(input: {
  geometricSides: AxialEdgeRef[]
  beams: CutPiece[]
  profiles: Map<string, ProfileDimensions>
  /** Selected frame beam profile (`params.beamProfileId`) — inner clear span & consistency. */
  beamProfileId: string
  centroid: Point2D
  contourVertices: Point2D[]
  lamellaDirectionDeg: number
  dividerPositions: ResolvedPurlinPosition[]
  /**
   * `manual`: the divider lines sit where the operator put them, so the chain
   * shows the real clear of every bay. Not `manual` (auto, or unset on older
   * callers): with typed outers or layout v1 the chain shows the equal clear
   * the formula gives for that many dividers.
   */
  purlinDividerMode?: PurlinDividerMode
  /** Site measurements keyed by contour edge index. Present ⇒ label is that value. */
  measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
  contourIsClosed?: boolean
  purlinClearLayoutVersion?: PurlinClearLayoutVersion
  /** Per-side end beams. Unset ⇒ both ends use `beamProfileId` plan width. */
  leftEndWidthMm?: number
  rightEndWidthMm?: number
  /** Per-side plan width for outer-face labels. Unset ⇒ one beam width. */
  planWidthForContourEdge?: (edgeIndex: number) => number
  /** Edge direction in degrees, same order as the contour. Disagreement hides the labels. */
  edgeHeadingDeg?: number[]
  /** Open chain: the closing corner would be invented. */
  suppressVertexAngles?: boolean
}): TopPlanDimensionModel {
  const beamWidthMm = profilePlanWidthMm(input.profiles, input.beamProfileId)
  const leftEndWidthMm = input.leftEndWidthMm ?? beamWidthMm
  const rightEndWidthMm = input.rightEndWidthMm ?? beamWidthMm
  const dividerWidthMm = DIVIDER_PLAN_CLEARANCE_WIDTH_MM
  const layoutV1 = isPurlinClearLayoutV1(input.purlinClearLayoutVersion)
  const profileWidth = (beam: CutPiece) =>
    beamPlanWidthForDrawing(input.profiles, beam.profileId).planWidthMm
  const perimeterChains = buildOuterPerimeterDimensionChains(
    input.geometricSides,
    input.beams,
    beamWidthMm,
    input.centroid,
    profileWidth,
    {
      contourVertices: input.contourVertices,
      contourIsClosed: input.contourIsClosed,
      measuredOuterLengthMmByEdgeIndex: input.measuredOuterLengthMmByEdgeIndex,
      planWidthForContourEdge: input.planWidthForContourEdge ?? (() => beamWidthMm),
    },
  )
  const primaryForInset = pickPrimaryLamellaParallelSide({
    sides: input.geometricSides,
    perimeterChains,
    lamellaDirectionDeg: input.lamellaDirectionDeg,
    dividerPositions: input.dividerPositions,
    beamWidthMm,
  })
  const axisLengthMm = primaryForInset
    ? primaryForInset.sideMax - primaryForInset.sideMin
    : 0
  const outerForInset = primaryForInset?.outerLengthMm ?? axisLengthMm
  const measured = input.measuredOuterLengthMmByEdgeIndex
  const outerIsExplicit = Array.isArray(measured) && measured.some((v) => v != null && v > 0)
  const endInsetMm = resolvePurlinEndInsetMm({
    axisLengthMm,
    outerLengthMm: outerForInset,
    endWidthMm: beamWidthMm,
    layoutVersion: input.purlinClearLayoutVersion,
    outerIsExplicit: layoutV1 || outerIsExplicit,
  })

  let purlinClearChain = buildPurlinClearDimensionChain({
    geometricSides: input.geometricSides,
    perimeterChains,
    lamellaDirectionDeg: input.lamellaDirectionDeg,
    beamWidthMm,
    dividerWidthMm,
    dividerPositions: input.dividerPositions,
    centroid: input.centroid,
    endInsetMm,
  })
  let purlinClearVerification: MaxPurlinClearGapVerification | null = null
  let purlinClearDisplaySummary: PurlinClearDisplaySummary | null = null
  if (purlinClearChain && purlinClearChain.segmentsMm.length > 0) {
    const primary = pickPrimaryLamellaParallelSide({
      sides: input.geometricSides,
      perimeterChains,
      lamellaDirectionDeg: input.lamellaDirectionDeg,
      dividerPositions: input.dividerPositions,
      beamWidthMm,
      endInsetMm,
    })
    const outerLengthMm = primary?.outerLengthMm ?? 0
    const dividerCount = purlinClearChain.segmentsMm.length - 1
    const formulaClear = computeEqualPurlinClearMm({
      outerLengthMm,
      leftEndWidthMm,
      rightEndWidthMm,
      dividerCount,
      dividerWidthMm,
    })
    // Manual dividers are placed on purpose; replacing their gaps with the equal
    // clear would print numbers the plan does not have.
    if ((layoutV1 || outerIsExplicit) && primary && input.purlinDividerMode !== 'manual') {
      const equalGaps = purlinClearChain.segmentsMm.map(() => formulaClear)
      let alongMm = 0
      const points = purlinClearChain.points.map((point, i) => {
        if (i === 0) return { ...point, distanceFromStartMm: 0 }
        alongMm += equalGaps[i - 1] ?? formulaClear
        return { ...point, distanceFromStartMm: alongMm }
      })
      purlinClearChain = { ...purlinClearChain, points, segmentsMm: equalGaps }
      purlinClearDisplaySummary = {
        sectionClearMm: formulaClear,
        sectionClearLabel: formatPurlinClearLabelMm(formulaClear),
        sectionCount: equalGaps.length,
      }
      purlinClearVerification = verifyPurlinClearsAgainstMaxRule({
        gapsMm: equalGaps,
        outerLengthMm,
        endBeamPlanWidthMm: beamWidthMm,
        dividerWidthMm,
      })
    } else {
      const gaps = purlinClearChain.segmentsMm
      const spread = Math.max(...gaps) - Math.min(...gaps)
      if (spread <= PURLIN_CLEAR_LABEL_UNIFORM_TOLERANCE_MM) {
        const clear = gaps.reduce((a, b) => a + b, 0) / gaps.length
        purlinClearDisplaySummary = {
          sectionClearMm: clear,
          sectionClearLabel: formatPurlinClearLabelMm(clear),
          sectionCount: gaps.length,
        }
      }
      if (primary) {
        purlinClearVerification = verifyPurlinClearsAgainstMaxRule({
          gapsMm: gaps,
          outerLengthMm,
          endBeamPlanWidthMm: beamWidthMm,
          dividerWidthMm,
        })
      }
    }
  }
  const vertexAngles = vertexAnglesForContour(input.contourVertices, {
    edgeHeadingDeg: input.edgeHeadingDeg,
    suppress: input.suppressVertexAngles,
  })
  return {
    perimeterChains,
    purlinClearChain,
    purlinClearVerification,
    purlinClearDisplaySummary,
    vertexAngles: vertexAngles.angles,
    angleClosureWarning: vertexAngles.warning,
  }
}

export interface PurlinClearSideDiagnosis {
  outerLengthMm: number
  outerLengthSource: 'perimeter-label'
  leftEndWidthMm: number
  rightEndWidthMm: number
  endWidthSource: string
  dividerCount: number
  dividerWidthMm: number
  dividerAxisPositionsMm: number[]
  axisMinMm: number
  axisMaxMm: number
  axisLengthMm: number
  endInsetMm: number
  innerLeftMm: number
  innerRightMm: number
  formulaClearMm: number
  measuredClearsMm: number[]
  extraVsFormulaSumMm: number
}

/** Dump L_outer, end widths, axes, inner faces, and each clear — no guessing. */
export function diagnosePurlinClearsOnPrimarySide(input: {
  geometricSides: AxialEdgeRef[]
  perimeterChains: AxialDimensionChain[]
  lamellaDirectionDeg: number
  dividerPositions: ResolvedPurlinPosition[]
  beamWidthMm: number
  beamProfileId: string
  endInsetMm?: number
}): PurlinClearSideDiagnosis | null {
  const beamWidthMm = input.beamWidthMm
  const endInsetMm = input.endInsetMm ?? beamWidthMm
  const primary = pickPrimaryLamellaParallelSide({
    sides: input.geometricSides,
    perimeterChains: input.perimeterChains,
    lamellaDirectionDeg: input.lamellaDirectionDeg,
    dividerPositions: input.dividerPositions,
    beamWidthMm,
    endInsetMm,
  })
  if (!primary) return null
  const { outerLengthMm, sideMin, sideMax, dividersOnSide } = primary
  const measuredClearsMm = computePurlinClearGapsMm({
    rangeMinMm: sideMin,
    rangeMaxMm: sideMax,
    beamWidthMm,
    dividerWidthMm: DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
    dividerPositions: dividersOnSide,
    endInsetMm,
  })
  const formulaClearMm = computeEqualPurlinClearMm({
    outerLengthMm,
    leftEndWidthMm: beamWidthMm,
    rightEndWidthMm: beamWidthMm,
    dividerCount: dividersOnSide.length,
  })
  const extraVsFormulaSumMm =
    measuredClearsMm.reduce((a, b) => a + b, 0) - formulaClearMm * measuredClearsMm.length
  return {
    outerLengthMm,
    outerLengthSource: 'perimeter-label',
    leftEndWidthMm: beamWidthMm,
    rightEndWidthMm: beamWidthMm,
    endWidthSource: `beamPlanWidthForDrawing(${input.beamProfileId}).planWidthMm`,
    dividerCount: dividersOnSide.length,
    dividerWidthMm: DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
    dividerAxisPositionsMm: dividersOnSide.map((d) => d.positionMm),
    axisMinMm: sideMin,
    axisMaxMm: sideMax,
    axisLengthMm: sideMax - sideMin,
    endInsetMm,
    innerLeftMm: sideMin + endInsetMm,
    innerRightMm: sideMax - endInsetMm,
    formulaClearMm,
    measuredClearsMm,
    extraVsFormulaSumMm,
  }
}
