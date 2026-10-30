import type { Point2D } from './types'
import { isCCW } from './miter'
import { interiorAngleDegAtVertex } from './topPlanDimensions'
import { sanitizeContour } from './contourSanitize'

const PARALLEL_ANGLE_TOLERANCE_DEG = 0.5
const PARALLEL_COS = Math.cos((PARALLEL_ANGLE_TOLERANCE_DEG * Math.PI) / 180)
const INTERIOR_CONCAVE_MIN_DEG = 180 + 0.5
const EPS = 1e-6

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
  return l > EPS ? scale(a, 1 / l) : [1, 0]
}

function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const crosses =
      yi !== yj &&
      ((point[1] >= yi && point[1] < yj) || (point[1] >= yj && point[1] < yi)) &&
      point[0] < xi + ((point[1] - yi) / (yj - yi)) * (xj - xi)
    if (crosses) inside = !inside
  }
  return inside
}

function parallelToDirection(edge: Point2D, dir: Point2D): boolean {
  const u = unit(edge)
  return Math.abs(dot(u, dir)) >= PARALLEL_COS
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
  if (s >= -1e-9 && s <= 1 + 1e-9) return t
  return null
}

/** Maximal chord along `dir` through `origin` that lies inside the polygon. */
function chordInsidePolygonAlongDir(
  contour: Point2D[],
  origin: Point2D,
  dir: Point2D,
): { start: Point2D; end: Point2D } | null {
  const u = unit(dir)
  const ts: number[] = [0]
  const n = contour.length
  for (let i = 0; i < n; i++) {
    const t = intersectLineSegment(origin, u, contour[i], contour[(i + 1) % n])
    if (t != null && Number.isFinite(t)) ts.push(t)
  }
  ts.sort((a, b) => a - b)
  const unique: number[] = []
  for (const t of ts) {
    if (unique.length === 0 || Math.abs(t - unique[unique.length - 1]) > 1e-6) unique.push(t)
  }

  let best: { start: Point2D; end: Point2D; forward: number } | null = null
  for (let i = 0; i + 1 < unique.length; i++) {
    const t0 = unique[i]
    const t1 = unique[i + 1]
    if (t0 > 1e-9 || t1 < -1e-9) continue
    const mid = add(origin, scale(u, (t0 + t1) / 2))
    if (!pointInPolygon(mid, contour)) continue
    const forward = Math.max(t0, t1)
    const backward = Math.min(t0, t1)
    if (forward < backward + 1) continue
    const candidate = {
      start: add(origin, scale(u, t0)),
      end: add(origin, scale(u, t1)),
      forward,
    }
    if (!best || candidate.forward > best.forward) best = candidate
  }
  if (!best) return null
  return { start: best.start, end: best.end }
}

function minDistanceToEdges(point: Point2D, polygon: Point2D[]): number {
  let best = Infinity
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % n]
    const ab = sub(b, a)
    const abLen = len(ab)
    if (abLen < EPS) continue
    const t = Math.max(0, Math.min(1, dot(sub(point, a), ab) / (abLen * abLen)))
    const proj = add(a, scale(ab, t))
    const d = len(sub(point, proj))
    if (d < best) best = d
  }
  return best
}

function chordInteriorScore(chord: { start: Point2D; end: Point2D } | null, contour: Point2D[]): number {
  if (!chord) return -1
  const mid: Point2D = [(chord.start[0] + chord.end[0]) / 2, (chord.start[1] + chord.end[1]) / 2]
  if (!pointInPolygon(mid, contour)) return -1
  return minDistanceToEdges(mid, contour) * 1000 + len(sub(chord.end, chord.start))
}

/** Prefer the lamella-parallel chord whose midpoint is inside the bay, not on an existing beam. */
function bestInteriorShelfDir(v: Point2D, along: Point2D, contour: Point2D[]): Point2D {
  const u = unit(along)
  const forward = chordInsidePolygonAlongDir(contour, v, u)
  const backward = chordInsidePolygonAlongDir(contour, v, scale(u, -1))
  return chordInteriorScore(backward, contour) > chordInteriorScore(forward, contour) ? scale(u, -1) : u
}

export interface WingShelfEdgeChoice {
  vertexIndex: number
  /** Lamella-parallel contour edge used (incoming or outgoing at the concave vertex). */
  usedIncomingEdge: boolean
  interiorAngleDeg: number
}

/**
 * At a concave (reflex) vertex, build the raw shelf segment along the contour edge
 * parallel to lamella direction — not along the edge parallel to ordinary purlins.
 */
export function wingShelfRawAtConcaveVertex(
  contour: Point2D[],
  vertexIndex: number,
  lamellaDirectionDeg: number,
): { start: Point2D; end: Point2D; choice: WingShelfEdgeChoice } | null {
  const n = contour.length
  const prev = contour[(vertexIndex + n - 1) % n]
  const v = contour[vertexIndex]
  const next = contour[(vertexIndex + 1) % n]
  const interior = interiorAngleDegAtVertex(prev, v, next)
  if (interior <= INTERIOR_CONCAVE_MIN_DEG) return null

  const lamRad = (lamellaDirectionDeg * Math.PI) / 180
  const lamDir = unit([Math.cos(lamRad), Math.sin(lamRad)])

  const eIn = sub(v, prev)
  const eOut = sub(next, v)
  const inPar = parallelToDirection(eIn, lamDir)
  const outPar = parallelToDirection(eOut, lamDir)

  let along: Point2D | null = null
  let usedIncoming = true
  if (inPar && !outPar) {
    along = eIn
    usedIncoming = true
  } else if (outPar && !inPar) {
    along = eOut
    usedIncoming = false
  } else if (inPar && outPar) {
    along = eIn
    usedIncoming = true
  } else {
    return null
  }

  const into = bestInteriorShelfDir(v, along, contour)
  const chord = chordInsidePolygonAlongDir(contour, v, into)
  if (!chord || len(sub(chord.end, chord.start)) < 1) return null

  const mid: Point2D = [(chord.start[0] + chord.end[0]) / 2, (chord.start[1] + chord.end[1]) / 2]
  if (!pointInPolygon(mid, contour)) return null

  return {
    start: chord.start,
    end: chord.end,
    choice: { vertexIndex, usedIncomingEdge: usedIncoming, interiorAngleDeg: interior },
  }
}

/** Shift the raw shelf onto the notch-side face of its source beam (not the centerline). */
export function offsetShelfToNotchFace(
  shelf: { start: Point2D; end: Point2D },
  contour: Point2D[],
  offsetMm: number,
): { start: Point2D; end: Point2D } {
  if (!(offsetMm > 0)) return { start: shelf.start, end: shelf.end }
  const clean = sanitizeContour(contour)
  const pts = isCCW(clean) ? clean : [...clean].reverse()
  const dir = unit(sub(shelf.end, shelf.start))
  const candidateA: Point2D = [-dir[1], dir[0]]
  const candidateB: Point2D = [dir[1], -dir[0]]
  const mid: Point2D = [(shelf.start[0] + shelf.end[0]) / 2, (shelf.start[1] + shelf.end[1]) / 2]
  const outward = shelfEdgeOutwardNormal(pts, shelf, mid, candidateA, candidateB)
  return {
    start: add(shelf.start, scale(outward, offsetMm)),
    end: add(shelf.end, scale(outward, offsetMm)),
  }
}

function shelfEdgeOutwardNormal(
  pts: Point2D[],
  shelf: { start: Point2D; end: Point2D },
  mid: Point2D,
  candidateA: Point2D,
  candidateB: Point2D,
): Point2D {
  let bestEdge: { start: Point2D; end: Point2D; score: number } | null = null
  const n = pts.length
  const shelfDir = unit(sub(shelf.end, shelf.start))
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const e = sub(b, a)
    const el = len(e)
    if (el < 1) continue
    const u = scale(e, 1 / el)
    if (Math.abs(dot(u, shelfDir)) < PARALLEL_COS) continue
    const dist = Math.abs((mid[0] - a[0]) * -u[1] + (mid[1] - a[1]) * u[0])
    const score = -dist
    if (!bestEdge || score > bestEdge.score) bestEdge = { start: a, end: b, score }
  }
  if (bestEdge) {
    const edgeMid: Point2D = [
      (bestEdge.start[0] + bestEdge.end[0]) / 2,
      (bestEdge.start[1] + bestEdge.end[1]) / 2,
    ]
    const centroid = pts.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
    const c: Point2D = [centroid[0] / pts.length, centroid[1] / pts.length]
    const ev = unit(sub(bestEdge.end, bestEdge.start))
    const cand: Point2D = [-ev[1], ev[0]]
    const towardCentroid = dot(sub(c, edgeMid), cand)
    return towardCentroid > 0 ? scale(cand, -1) : cand
  }
  const probeA = add(mid, scale(candidateA, 1))
  return pointInPolygon(probeA, pts) ? candidateB : candidateA
}

/** Interior posts along a support longer than maxSpan (same rule as frame edges). */
/**
 * The face line sits on the notch-side face of the beam. The drawn shelf is a
 * band of `bandMm` further into the notch, top flush with that face. The clip
 * line is the beam center, so vertical purlins stop on the two beam faces
 * and are not shortened by the band.
 */
export function placeWingShelfFlushBand(
  face: { start: Point2D; end: Point2D },
  contour: Point2D[],
  bandMm: number,
): { axisStart: Point2D; axisEnd: Point2D; clipStart: Point2D; clipEnd: Point2D } {
  const clean = sanitizeContour(contour)
  const pts = isCCW(clean) ? clean : [...clean].reverse()
  const mid: Point2D = [(face.start[0] + face.end[0]) / 2, (face.start[1] + face.end[1]) / 2]
  let best: { start: Point2D; end: Point2D; dist: number } | null = null
  const faceDir = unit(sub(face.end, face.start))
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const e = sub(b, a)
    const el = len(e)
    if (el < 1) continue
    const u = scale(e, 1 / el)
    if (Math.abs(dot(u, faceDir)) < PARALLEL_COS) continue
    const dist = Math.abs((mid[0] - a[0]) * -u[1] + (mid[1] - a[1]) * u[0])
    if (!best || dist < best.dist) best = { start: a, end: b, dist }
  }
  const edge = best ?? { start: face.start, end: face.end }
  const ev = unit(sub(edge.end, edge.start))
  const n: Point2D = [-ev[1], ev[0]]
  const edgeMid: Point2D = [(edge.start[0] + edge.end[0]) / 2, (edge.start[1] + edge.end[1]) / 2]
  const notch = pointInPolygon(add(edgeMid, scale(n, 2)), pts) ? scale(n, -1) : n
  const faceMid: Point2D = [(face.start[0] + face.end[0]) / 2, (face.start[1] + face.end[1]) / 2]
  const current = dot(sub(faceMid, edgeMid), notch)
  const moveAxis = scale(notch, bandMm - current)
  const moveClip = scale(notch, -current)
  return {
    axisStart: add(face.start, moveAxis),
    axisEnd: add(face.end, moveAxis),
    clipStart: add(face.start, moveClip),
    clipEnd: add(face.end, moveClip),
  }
}

export function wingShelfInteriorPostFractions(lengthMm: number, maxSpanMm: number | undefined): number[] {
  if (maxSpanMm == null || !(maxSpanMm > 0) || !(lengthMm > maxSpanMm)) return []
  const nInter = Math.ceil(lengthMm / maxSpanMm) - 1
  if (nInter <= 0) return []
  const ts: number[] = []
  for (let k = 1; k <= nInter; k++) ts.push(k / (nInter + 1))
  return ts
}

export function findConcaveLamellaParallelShelfRaw(
  contourInput: Point2D[],
  lamellaDirectionDeg: number,
): { start: Point2D; end: Point2D; choice: WingShelfEdgeChoice } | null {
  const clean = sanitizeContour(contourInput)
  const pts = isCCW(clean) ? clean : [...clean].reverse()
  const n = pts.length
  if (n < 4) return null

  let best: { start: Point2D; end: Point2D; choice: WingShelfEdgeChoice; len: number } | null = null
  for (let i = 0; i < n; i++) {
    const raw = wingShelfRawAtConcaveVertex(pts, i, lamellaDirectionDeg)
    if (!raw) continue
    const segLen = len(sub(raw.end, raw.start))
    if (!best || segLen > best.len) {
      best = { ...raw, len: segLen }
    }
  }
  return best
}
