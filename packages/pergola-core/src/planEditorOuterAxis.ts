import type { Point2D } from './types'
import { sanitizeContour } from './contourSanitize'
import { edgeValuesInCcwOrder, isCCW } from './miter'

const CLOSURE_GAP_FOR_CLOSED_MM = 0.5

function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}

/**
 * CCW contour, travel vectors (in = vertex−prev, out = next−vertex).
 * Right turn (cross < 0) is reflex — same hand as miter.ts (fromPrev/toNext).
 */
export function isConcaveVertexCCW(prev: Point2D, vertex: Point2D, next: Point2D): boolean {
  const eIn = sub(vertex, prev)
  const eOut = sub(next, vertex)
  const crossZ = eIn[0] * eOut[1] - eIn[1] * eOut[0]
  return crossZ < 0
}

export type VertexCornerKind = 'convex' | 'concave'

export function vertexCornerKindCCW(prev: Point2D, vertex: Point2D, next: Point2D): VertexCornerKind {
  return isConcaveVertexCCW(prev, vertex, next) ? 'concave' : 'convex'
}

/**
 * Half of (outer − axis) contributed by one end of an edge at a vertex.
 * Convex +w/2, concave −w/2 (plan width of the beam along this edge).
 */
export function outerHalfDeltaAtVertex(
  prev: Point2D,
  vertex: Point2D,
  next: Point2D,
  beamPlanWidthMm: number,
): number {
  const half = beamPlanWidthMm / 2
  return isConcaveVertexCCW(prev, vertex, next) ? -half : half
}

export interface OuterAxisVertexReport {
  vertexIndex: number
  point: Point2D
  kind: VertexCornerKind
  widthIncomingMm: number
  widthOutgoingMm: number
  halfDeltaIncoming: number
  halfDeltaOutgoing: number
}

export interface OuterAxisEdgeReport {
  edgeIndex: number
  outerLengthMm: number
  outerDeltaMm: number
  axisLengthMm: number
  beamPlanWidthMm: number
}

export interface OuterAxisClosureReport {
  vertices: OuterAxisVertexReport[]
  edges: OuterAxisEdgeReport[]
  kinematicOuterGapMm: number
  axisClosureGapMm: number
}

function contourFromEdgeLengths(
  lengthsMm: number[],
  angleDeg: number[],
  start: Point2D = [0, 0],
): Point2D[] {
  let x = start[0]
  let y = start[1]
  const vertices: Point2D[] = [[x, y]]
  const n = lengthsMm.length
  for (let i = 0; i < n; i++) {
    const rad = (angleDeg[i] * Math.PI) / 180
    x += lengthsMm[i] * Math.cos(rad)
    y += lengthsMm[i] * Math.sin(rad)
    if (i < n - 1) vertices.push([x, y])
  }
  return vertices
}

function kinematicGapMm(lengthsMm: number[], angleDeg: number[]): number {
  let x = 0
  let y = 0
  for (let i = 0; i < lengthsMm.length; i++) {
    const rad = (angleDeg[i] * Math.PI) / 180
    x += lengthsMm[i] * Math.cos(rad)
    y += lengthsMm[i] * Math.sin(rad)
  }
  return Math.hypot(x, y)
}

function axisClosureGapMm(axisLengths: number[], angleDeg: number[]): number {
  return kinematicGapMm(axisLengths, angleDeg)
}

/**
 * Outer − axis for one contour side using convex +w/2 / concave −w/2 at each end.
 */
export function outerDeltaMmOnContourSideVertexRule(
  contour: Point2D[],
  edgeIndex: number,
  beamPlanWidthMm: number,
  planWidthForEdge?: (edgeIndex: number) => number,
): number {
  const clean = sanitizeContour(contour)
  const pts = isCCW(clean) ? clean : [...clean].reverse()
  const n = pts.length
  if (n < 3 || edgeIndex < 0 || edgeIndex >= n) return 0

  const widthAt = (i: number) => planWidthForEdge?.(i) ?? beamPlanWidthMm
  const i = edgeIndex
  const prev = pts[(i + n - 1) % n]
  const v0 = pts[i]
  const v1 = pts[(i + 1) % n]
  const next = pts[(i + 2) % n]
  // Each end uses the adjacent side's plan width (the beam that crosses this edge).
  const wStart = widthAt((i + n - 1) % n)
  const wEnd = widthAt((i + 1) % n)
  return (
    outerHalfDeltaAtVertex(prev, v0, v1, wStart) + outerHalfDeltaAtVertex(v0, v1, next, wEnd)
  )
}

export function axisLengthsFromOuterLengthsMm(input: {
  outerLengthsMm: number[]
  angleDeg: number[]
  defaultBeamPlanWidthMm: number
  planWidthForEdge?: (edgeIndex: number) => number
}): number[] {
  const { outerLengthsMm, angleDeg, defaultBeamPlanWidthMm, planWidthForEdge } = input
  const n = outerLengthsMm.length
  if (n === 0 || n !== angleDeg.length) return []

  const topo = contourFromEdgeLengths(outerLengthsMm, angleDeg)
  const clean = sanitizeContour(topo)
  const pts = isCCW(clean) ? clean : [...clean].reverse()

  const axis: number[] = []
  for (let i = 0; i < n; i++) {
    const delta = outerDeltaMmOnContourSideVertexRule(
      pts,
      i,
      defaultBeamPlanWidthMm,
      planWidthForEdge,
    )
    axis.push(outerLengthsMm[i] - Math.max(0, delta))
  }
  return axis
}

export function buildOuterAxisClosureReport(input: {
  outerLengthsMm: number[]
  angleDeg: number[]
  defaultBeamPlanWidthMm: number
  planWidthForEdge?: (edgeIndex: number) => number
}): OuterAxisClosureReport {
  const { outerLengthsMm, angleDeg, defaultBeamPlanWidthMm, planWidthForEdge } = input
  const n = outerLengthsMm.length
  const widthAt = (i: number) => planWidthForEdge?.(i) ?? defaultBeamPlanWidthMm

  const topo = contourFromEdgeLengths(outerLengthsMm, angleDeg)
  const clean = sanitizeContour(topo)
  const pts = isCCW(clean) ? clean : [...clean].reverse()

  const vertices: OuterAxisVertexReport[] = []
  for (let vi = 0; vi < pts.length; vi++) {
    const prev = pts[(vi + n - 1) % n]
    const v = pts[vi]
    const next = pts[(vi + 1) % n]
    const wIn = widthAt((vi + n - 1) % n)
    const wOut = widthAt(vi)
    const kind = vertexCornerKindCCW(prev, v, next)
    vertices.push({
      vertexIndex: vi,
      point: v,
      kind,
      widthIncomingMm: wIn,
      widthOutgoingMm: wOut,
      halfDeltaIncoming: outerHalfDeltaAtVertex(prev, v, next, wIn),
      halfDeltaOutgoing: outerHalfDeltaAtVertex(prev, v, next, wOut),
    })
  }

  const axisLengths = axisLengthsFromOuterLengthsMm(input)
  const edges: OuterAxisEdgeReport[] = []
  for (let i = 0; i < n; i++) {
    const w = widthAt(i)
    const outerDeltaMm = outerDeltaMmOnContourSideVertexRule(pts, i, defaultBeamPlanWidthMm, planWidthForEdge)
    edges.push({
      edgeIndex: i,
      outerLengthMm: outerLengthsMm[i],
      outerDeltaMm,
      axisLengthMm: axisLengths[i],
      beamPlanWidthMm: w,
    })
  }

  return {
    vertices,
    edges,
    kinematicOuterGapMm: kinematicGapMm(outerLengthsMm, angleDeg),
    axisClosureGapMm: axisClosureGapMm(axisLengths, angleDeg),
  }
}

/** Display outer length: one rounding step at the end (mm). */
export function displayOuterLengthMm(axisLengthMm: number, outerDeltaMm: number): number {
  return Math.round(axisLengthMm + outerDeltaMm)
}

export function treatContourAsClosedForOuterDelta(closureGapMm: number, vertexCount: number): boolean {
  return closureGapMm <= CLOSURE_GAP_FOR_CLOSED_MM && vertexCount >= 3
}

export type ContourBeamWidthMatch = 'match' | 'mismatch' | 'no-outers'

function edgeHeadingsDeg(contour: Point2D[]): number[] {
  const n = contour.length
  return Array.from({ length: n }, (_, i) => {
    const a = contour[i]
    const b = contour[(i + 1) % n]
    return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
  })
}

function contourWithMeasured(
  contour: Point2D[],
  measured: Array<number | null | undefined> | undefined,
): { pts: Point2D[]; measured: Array<number | null | undefined> | undefined } {
  const clean = sanitizeContour(contour)
  if (isCCW(clean)) return { pts: clean, measured }
  return { pts: [...clean].reverse(), measured: edgeValuesInCcwOrder(clean, measured) }
}

/**
 * Saved centerlines stay as stored. `mismatch` means those centerlines were
 * built for a different beam width than the one drawn now.
 * `no-outers` means the plan has no typed outer lengths (nothing to compare).
 */
export function contourAxesMatchEnteredOuters(input: {
  contour: Point2D[]
  measuredOuterLengthMmByEdgeIndex: Array<number | null | undefined> | undefined
  defaultBeamPlanWidthMm: number
  planWidthForEdge?: (edgeIndex: number) => number
}): ContourBeamWidthMatch {
  const { pts, measured } = contourWithMeasured(input.contour, input.measuredOuterLengthMmByEdgeIndex)
  if (pts.length < 3 || !measured || measured.length !== pts.length) return 'no-outers'
  if (measured.some((value) => typeof value !== 'number')) return 'no-outers'
  const outers = measured as number[]
  const axis = axisLengthsFromOuterLengthsMm({
    outerLengthsMm: outers,
    angleDeg: edgeHeadingsDeg(pts),
    defaultBeamPlanWidthMm: input.defaultBeamPlanWidthMm,
    planWidthForEdge: input.planWidthForEdge,
  })
  if (axis.length !== pts.length) return 'no-outers'
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const stored = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (Math.abs(stored - axis[i]) > 1) return 'mismatch'
  }
  return 'match'
}

/** Rebuild centerlines from the typed outers and the current beam widths. */
export function rebuildContourForEnteredOuters(input: {
  contour: Point2D[]
  measuredOuterLengthMmByEdgeIndex: number[]
  defaultBeamPlanWidthMm: number
  planWidthForEdge?: (edgeIndex: number) => number
}): Point2D[] | null {
  const { pts, measured } = contourWithMeasured(input.contour, input.measuredOuterLengthMmByEdgeIndex)
  if (pts.length < 3 || !measured || measured.length !== pts.length) return null
  if (measured.some((value) => typeof value !== 'number')) return null
  const angleDeg = edgeHeadingsDeg(pts)
  const axis = axisLengthsFromOuterLengthsMm({
    outerLengthsMm: measured as number[],
    angleDeg,
    defaultBeamPlanWidthMm: input.defaultBeamPlanWidthMm,
    planWidthForEdge: input.planWidthForEdge,
  })
  if (axis.length !== pts.length || axis.some((length) => !(length > 1))) return null
  return contourFromEdgeLengths(axis, angleDeg, pts[0])
}
