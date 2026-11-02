/**
 * Optional straight support beams on `Pergola.plan.supportBeams`.
 * Stored as plan-mm coordinates + purlin ids — never contour edge/vertex indices.
 */

import { beamPlanWidthForDrawing } from './beamPlanWidth'
import { cutAtEdge } from './lamellas'
import type { LamellaSectionSupportLine } from './lamellaSections'
import { longPointOffset } from './lamellas'
import { isCCW } from './miter'
import { pieceAxis } from './pieceAxis'
import { WING_SHELF_SPAN_DIVIDER_ID } from './planEditorDimensions'
import type { CutPiece, PergolaSpec, Point2D, ProfileDimensions } from './types'

/** Format version of the `supportBeams` document (independent of plan schemaVersion). */
export const SUPPORT_BEAMS_FORMAT_VERSION = 1 as const

export type StraightSupportBeamKind = 'straight'
export type SupportBeamPurlinFace = 'low' | 'high'

export interface StraightSupportBeamStart {
  /** Id from `params.purlinDividers.lines` (e.g. `row-5`). */
  purlinId: string
  face: SupportBeamPurlinFace
}

export interface StraightSupportBeamEnd {
  /** Beam runs to the outer contour; the hit is computed. */
  kind: 'outer-contour'
}

/**
 * One straight beam in plan millimetres.
 * `anchorMm` lies on the beam axis (typically the start face). Direction defaults
 * to the plan's lamella direction when omitted.
 */
export interface StraightSupportBeam {
  id: string
  kind: StraightSupportBeamKind
  anchorMm: { x: number; y: number }
  /** Degrees from +X; omit ⇒ `spec.lamellaDirectionDeg`. */
  directionDeg?: number
  profileId: string
  /** Plan width mm; omit ⇒ profile drawing width. */
  widthMm?: number
  start: StraightSupportBeamStart
  end: StraightSupportBeamEnd
}

export interface SupportBeamsDocument {
  formatVersion: typeof SUPPORT_BEAMS_FORMAT_VERSION
  beams: StraightSupportBeam[]
}

export interface ResolvedStraightSupportBeam {
  id: string
  profileId: string
  widthMm: number
  start: Point2D
  /** Axis end on the inner face of the frame (cut length). */
  endInner: Point2D
  /** Axis end on the outer face of the frame (drawing reference). */
  endOuter: Point2D
  direction: Point2D
  startPurlinId: string
  endCutMiterDeg: number
  endCutHand: 'L' | 'R' | 'straight'
}

function unitOf(a: Point2D, b: Point2D): Point2D {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

function unitDir(deg: number): Point2D {
  const rad = (deg * Math.PI) / 180
  return [Math.cos(rad), Math.sin(rad)]
}

function along(p: Point2D, axis: Point2D): number {
  return p[0] * axis[0] + p[1] * axis[1]
}

function centroidOf(pts: Point2D[]): Point2D {
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ]
}

function purlinFacePositionMm(
  linePositionMm: number,
  purlinHalfMm: number,
  face: SupportBeamPurlinFace,
): number {
  return face === 'high' ? linePositionMm + purlinHalfMm : linePositionMm - purlinHalfMm
}

/**
 * Intersection of the beam axis (axis + t·dir, t≥0) with the edge moved by
 * `offsetMm` toward the contour interior. Returns the hit point or null.
 *
 * Edge is parametrized as (edgeStart + n·offset) + u·(edgeEnd−edgeStart), u∈[0,1].
 */
function hitOnOffsetEdge(
  edgeStart: Point2D,
  edgeEnd: Point2D,
  centroid: Point2D,
  offsetMm: number,
  axis: Point2D,
  dir: Point2D,
): Point2D | null {
  const edge: Point2D = [edgeEnd[0] - edgeStart[0], edgeEnd[1] - edgeStart[1]]
  const edgeLen = Math.hypot(edge[0], edge[1]) || 1
  const dUnit: Point2D = [edge[0] / edgeLen, edge[1] / edgeLen]
  let n: Point2D = [-dUnit[1], dUnit[0]]
  const toCentroid = (centroid[0] - edgeStart[0]) * n[0] + (centroid[1] - edgeStart[1]) * n[1]
  if (toCentroid < 0) n = [-n[0], -n[1]]
  const px = edgeStart[0] + n[0] * offsetMm
  const py = edgeStart[1] + n[1] * offsetMm
  // axis + t·dir = (px,py) + u·edge
  const det = dir[0] * (-edge[1]) - (-edge[0]) * dir[1]
  if (Math.abs(det) < 1e-9) return null
  const rhs0 = px - axis[0]
  const rhs1 = py - axis[1]
  const t = (rhs0 * (-edge[1]) - (-edge[0]) * rhs1) / det
  const u = (dir[0] * rhs1 - dir[1] * rhs0) / det
  if (t < -1e-6) return null
  if (u < -0.05 || u > 1.05) return null
  return [axis[0] + t * dir[0], axis[1] + t * dir[1]]
}

/**
 * Parse stored JSON. Invalid / empty / unknown formatVersion → undefined
 * (plan without beams — same as today).
 */
export function parseSupportBeamsDocument(raw: unknown): SupportBeamsDocument | undefined {
  if (raw == null || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  if (o.formatVersion !== SUPPORT_BEAMS_FORMAT_VERSION) return undefined
  if (!Array.isArray(o.beams) || o.beams.length === 0) return undefined
  const beams: StraightSupportBeam[] = []
  for (const item of o.beams) {
    if (!item || typeof item !== 'object') continue
    const b = item as Record<string, unknown>
    if (b.kind !== 'straight') continue
    if (typeof b.id !== 'string' || b.id.length === 0) continue
    const anchor = b.anchorMm
    if (!anchor || typeof anchor !== 'object') continue
    const ax = (anchor as { x?: unknown }).x
    const ay = (anchor as { y?: unknown }).y
    if (typeof ax !== 'number' || !Number.isFinite(ax) || typeof ay !== 'number' || !Number.isFinite(ay)) {
      continue
    }
    if (typeof b.profileId !== 'string' || b.profileId.length === 0) continue
    const start = b.start
    if (!start || typeof start !== 'object') continue
    const purlinId = (start as { purlinId?: unknown }).purlinId
    const face = (start as { face?: unknown }).face
    if (typeof purlinId !== 'string' || (face !== 'low' && face !== 'high')) continue
    const end = b.end
    if (!end || typeof end !== 'object' || (end as { kind?: unknown }).kind !== 'outer-contour') continue
    const beam: StraightSupportBeam = {
      id: b.id,
      kind: 'straight',
      anchorMm: { x: ax, y: ay },
      profileId: b.profileId,
      start: { purlinId, face },
      end: { kind: 'outer-contour' },
    }
    if (typeof b.directionDeg === 'number' && Number.isFinite(b.directionDeg)) {
      beam.directionDeg = b.directionDeg
    }
    if (typeof b.widthMm === 'number' && Number.isFinite(b.widthMm) && b.widthMm > 0) {
      beam.widthMm = b.widthMm
    }
    beams.push(beam)
  }
  if (beams.length === 0) return undefined
  return { formatVersion: SUPPORT_BEAMS_FORMAT_VERSION, beams }
}

export function supportBeamsEqual(
  a: SupportBeamsDocument | null | undefined,
  b: SupportBeamsDocument | null | undefined,
): boolean {
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Whether the plan document carries any usable straight beams. */
export function hasPlanSupportBeams(doc: SupportBeamsDocument | null | undefined): boolean {
  return doc != null && doc.formatVersion === SUPPORT_BEAMS_FORMAT_VERSION && doc.beams.length > 0
}

/** First straight beam as a section support line, or null. */
export function supportLineFromPlanBeams(
  resolved: ResolvedStraightSupportBeam[],
): LamellaSectionSupportLine | null {
  const first = resolved[0]
  if (!first) return null
  return { start: first.start, end: first.endInner, widthMm: first.widthMm }
}

export function resolveStraightSupportBeams(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): ResolvedStraightSupportBeam[] {
  const doc = spec.supportBeams
  if (!hasPlanSupportBeams(doc) || !doc) return []
  const lines = spec.purlinDividers?.mode === 'manual' ? spec.purlinDividers.lines ?? [] : []
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const pts = spec.contour
  const centroid = centroidOf(pts)
  const frameHalf = beamPlanWidthForDrawing(profiles, spec.beamProfileId).planWidthMm / 2
  const purlinProfileId = spec.purlinProfileId ?? spec.beamProfileId
  const purlinHalf = beamPlanWidthForDrawing(profiles, purlinProfileId).planWidthMm / 2
  const out: ResolvedStraightSupportBeam[] = []

  for (const beam of doc.beams) {
    if (beam.kind !== 'straight') continue
    const line = lineById.get(beam.start.purlinId)
    if (!line) continue
    const profileId = beam.profileId
    const widthMm =
      beam.widthMm && beam.widthMm > 0
        ? beam.widthMm
        : beamPlanWidthForDrawing(profiles, profileId).planWidthMm
    const dirDeg = beam.directionDeg ?? spec.lamellaDirectionDeg
    const dir = unitDir(dirDeg)
    const stack: Point2D = [-dir[1], dir[0]]
    const anchor: Point2D = [beam.anchorMm.x, beam.anchorMm.y]
    const axisStack = along(anchor, stack)
    const facePos = purlinFacePositionMm(line.positionMm, purlinHalf, beam.start.face)
    const start: Point2D = [
      facePos * dir[0] + axisStack * stack[0],
      facePos * dir[1] + axisStack * stack[1],
    ]

    let bestInner: Point2D | null = null
    let bestOuter: Point2D | null = null
    let bestT = -Infinity
    let bestEdgeA: Point2D | null = null
    let bestEdgeB: Point2D | null = null
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const inner = hitOnOffsetEdge(a, b, centroid, frameHalf, start, dir)
      if (!inner) continue
      const t = along(inner, dir) - along(start, dir)
      if (t > bestT) {
        bestT = t
        bestInner = inner
        bestOuter = hitOnOffsetEdge(a, b, centroid, -frameHalf, start, dir)
        bestEdgeA = a
        bestEdgeB = b
      }
    }
    if (!bestInner || !bestEdgeA || !bestEdgeB) continue

    const ccw: Point2D[] = isCCW(pts) ? pts : [...pts].reverse()
    const same = (p: Point2D, q: Point2D) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6
    let ccwEdge = -1
    for (let i = 0; i < ccw.length; i++) {
      const a = ccw[i]
      const b = ccw[(i + 1) % ccw.length]
      if (
        (same(a, bestEdgeA) && same(b, bestEdgeB)) ||
        (same(a, bestEdgeB) && same(b, bestEdgeA))
      ) {
        ccwEdge = i
        break
      }
    }
    const endCut =
      ccwEdge >= 0
        ? cutAtEdge(dir, ccw, ccwEdge)
        : { cutMiterDeg: 0, cutHand: 'straight' as const }

    out.push({
      id: beam.id,
      profileId,
      widthMm,
      start,
      endInner: bestInner,
      endOuter: bestOuter ?? bestInner,
      direction: dir,
      startPurlinId: beam.start.purlinId,
      endCutMiterDeg: endCut.cutMiterDeg,
      endCutHand: endCut.cutHand,
    })
  }
  return out
}

/**
 * Split purlins crossed by each straight beam and append the beam pieces.
 * Same cut rules as the former fixture `applyStraightBeam`.
 */
export function applyStraightSupportBeamsToPieces(input: {
  pieces: CutPiece[]
  spec: PergolaSpec
  profiles: Map<string, ProfileDimensions>
  resolved: ResolvedStraightSupportBeam[]
}): CutPiece[] {
  const { profiles, resolved, spec } = input
  let pieces = input.pieces
  for (const beam of resolved) {
    const half = beam.widthMm / 2
    const dir = beam.direction
    const stack: Point2D = [-dir[1], dir[0]]
    const axisStack = along(beam.start, stack)
    const startAlong = along(beam.start, dir)
    const endAlong = along(beam.endInner, dir)
    const axisLen = endAlong - startAlong
    const out: CutPiece[] = []
    const reference = pieces.find(
      (p) => p.role === 'purlin' && p.dividerId && p.dividerId !== WING_SHELF_SPAN_DIVIDER_ID,
    )
    const height = reference?.position[1] ?? spec.heightMm
    const color = reference?.color ?? spec.color

    for (const piece of pieces) {
      const crosses =
        piece.role === 'purlin' &&
        piece.dividerId !== WING_SHELF_SPAN_DIVIDER_ID &&
        (() => {
          const { start, end } = pieceAxis(piece)
          const mid: Point2D = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
          const midAlong = along(mid, dir)
          if (midAlong <= startAlong || midAlong >= endAlong) return false
          const s0 = along(start, stack)
          const s1 = along(end, stack)
          const lo = Math.min(s0, s1)
          const hi = Math.max(s0, s1)
          return lo + half < axisStack && axisStack < hi - half
        })()
      if (!crosses) {
        out.push(piece)
        continue
      }
      const { start, end } = pieceAxis(piece)
      const pdir = unitOf(start, end)
      const denom = along(pdir, stack)
      if (Math.abs(denom) < 1e-9) {
        out.push(piece)
        continue
      }
      const tHit = (axisStack - along(start, stack)) / denom
      const profileWidth = profiles.get(piece.profileId)?.widthMm ?? beam.widthMm
      const secondStart: Point2D = [
        start[0] + pdir[0] * (tHit + half),
        start[1] + pdir[1] * (tHit + half),
      ]
      const totalAxis = piece.lengthAxisMm
      const firstAxis = tHit - half
      const secondAxis = totalAxis - (tHit + half)
      const deltaStart = longPointOffset(piece.cutMiterStartDeg, profileWidth)
      const deltaEnd = longPointOffset(piece.cutMiterEndDeg, profileWidth)
      out.push(
        {
          ...piece,
          id: `${piece.id}-a`,
          lengthAxisMm: firstAxis,
          lengthLongMm: firstAxis + deltaStart,
          lengthShortMm: firstAxis - deltaStart,
          cutMiterEndDeg: 0,
          cutBevelEndDeg: 0,
          cutHandEnd: 'straight',
          clipPlanEnd: [start[0] + pdir[0] * firstAxis, start[1] + pdir[1] * firstAxis],
        },
        {
          ...piece,
          id: `${piece.id}-b`,
          position: [secondStart[0], piece.position[1], secondStart[1]],
          lengthAxisMm: secondAxis,
          lengthLongMm: secondAxis + deltaEnd,
          lengthShortMm: secondAxis - deltaEnd,
          cutMiterStartDeg: 0,
          cutBevelStartDeg: 0,
          cutHandStart: 'straight',
          clipPlanStart: secondStart,
        },
      )
    }

    const endDelta = longPointOffset(beam.endCutMiterDeg, beam.widthMm)
    const θ = Math.atan2(dir[1], dir[0])
    out.push({
      id: `purlin-support-beam-${beam.id}`,
      role: 'purlin',
      dividerId: WING_SHELF_SPAN_DIVIDER_ID,
      profileId: beam.profileId,
      lengthAxisMm: axisLen,
      lengthLongMm: axisLen + endDelta,
      lengthShortMm: axisLen - endDelta,
      cutMiterStartDeg: 0,
      cutBevelStartDeg: 0,
      cutHandStart: 'straight',
      cutMiterEndDeg: beam.endCutMiterDeg,
      cutBevelEndDeg: 0,
      cutHandEnd: beam.endCutHand,
      position: [beam.start[0], height, beam.start[1]],
      rotation: [0, -θ, 0],
      color,
      clipPlanStart: beam.start,
      clipPlanEnd: beam.endInner,
    })
    pieces = out
  }
  return pieces
}

/**
 * After a beam is placed, list manual purlin lines whose longest free clear
 * still exceeds `purlinMaxSpanMm` (nothing is auto-added).
 */
export function purlinLinesOverMaxSpanMm(input: {
  spec: PergolaSpec
  pieces: CutPiece[]
}): Array<{ purlinId: string; clearMm: number; maxSpanMm: number }> {
  const maxSpan = input.spec.purlinMaxSpanMm
  if (maxSpan == null || !(maxSpan > 0)) return []
  const lines = input.spec.purlinDividers?.mode === 'manual' ? input.spec.purlinDividers.lines ?? [] : []
  const out: Array<{ purlinId: string; clearMm: number; maxSpanMm: number }> = []
  for (const line of lines) {
    const segs = input.pieces.filter((p) => p.role === 'purlin' && p.dividerId === line.id)
    if (segs.length === 0) continue
    const longest = Math.max(...segs.map((p) => p.lengthAxisMm))
    if (longest > maxSpan + 0.5) {
      out.push({
        purlinId: line.id,
        clearMm: Math.round(longest * 10) / 10,
        maxSpanMm: maxSpan,
      })
    }
  }
  return out
}
