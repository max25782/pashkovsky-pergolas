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

function round1(n: number): number {
  return Math.round(n * 10) / 10
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

function stackBounds(
  contour: Point2D[],
  stack: Point2D,
  frameHalfMm: number,
): { minS: number; maxS: number } {
  let minS = Infinity
  let maxS = -Infinity
  for (const p of contour) {
    const s = p[0] * stack[0] + p[1] * stack[1]
    if (s < minS) minS = s
    if (s > maxS) maxS = s
  }
  return { minS: minS - frameHalfMm, maxS: maxS + frameHalfMm }
}

/**
 * Which stack extreme is the longest contour edge parallel to the lamellas
 * (the "straight side" Max measures from — EA on the pentagon).
 */
export function straightSideStackExtreme(
  contour: Point2D[],
  directionDeg: number,
): 'min-stack' | 'max-stack' {
  const rad = (directionDeg * Math.PI) / 180
  const dir: Point2D = [Math.cos(rad), Math.sin(rad)]
  const stack: Point2D = [-dir[1], dir[0]]
  let bestLen = -1
  let bestFrom: 'min-stack' | 'max-stack' = 'min-stack'
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % contour.length]
    const edge: Point2D = [b[0] - a[0], b[1] - a[1]]
    const len = Math.hypot(edge[0], edge[1])
    const along = Math.abs(edge[0] * dir[0] + edge[1] * dir[1]) / (len || 1)
    if (along < 0.95) continue
    if (len <= bestLen) continue
    bestLen = len
    const midS = ((a[0] + b[0]) / 2) * stack[0] + ((a[1] + b[1]) / 2) * stack[1]
    const { minS, maxS } = stackBounds(contour, stack, 0)
    bestFrom = Math.abs(midS - minS) <= Math.abs(midS - maxS) ? 'min-stack' : 'max-stack'
  }
  return bestFrom
}

/**
 * Build one straight beam whose axis sits at `axisFromSideMm` from the chosen
 * *outer* contour side along the stack axis (perpendicular to lamellas).
 *
 * Drawing convention (pentagon v2): typed offset is from the outer face of the
 * straight side (EA). Pass `frameHalfMm` (typically 20 for f10040). When `from`
 * is omitted, the longest edge parallel to the lamellas is used automatically
 * (works for both windings).
 */
export function makeStraightSupportBeam(input: {
  id?: string
  axisFromSideMm: number
  from?: 'min-stack' | 'max-stack'
  contour: Point2D[]
  startPurlinId: string
  face?: SupportBeamPurlinFace
  profileId: string
  widthMm?: number
  directionDeg?: number
  startPurlinPositionMm: number
  purlinHalfMm: number
  /** Half frame plan width; expands the stack AABB to outer faces. Default 0. */
  frameHalfMm?: number
}): StraightSupportBeam {
  const face = input.face ?? 'high'
  const dirDeg = input.directionDeg ?? 90
  const rad = (dirDeg * Math.PI) / 180
  const dir: Point2D = [Math.cos(rad), Math.sin(rad)]
  const stack: Point2D = [-dir[1], dir[0]]
  const frameHalf = input.frameHalfMm ?? 0
  const from = input.from ?? straightSideStackExtreme(input.contour, dirDeg)
  const { minS, maxS } = stackBounds(input.contour, stack, frameHalf)
  const axisStack = from === 'min-stack' ? minS + input.axisFromSideMm : maxS - input.axisFromSideMm
  const faceAlong = purlinFacePositionMm(input.startPurlinPositionMm, input.purlinHalfMm, face)
  const anchorX = axisStack * stack[0] + faceAlong * dir[0]
  const anchorY = axisStack * stack[1] + faceAlong * dir[1]
  return {
    id: input.id ?? `beam-${input.startPurlinId}-${Math.round(input.axisFromSideMm)}`,
    kind: 'straight',
    anchorMm: { x: round1(anchorX), y: round1(anchorY) },
    directionDeg: dirDeg,
    profileId: input.profileId,
    ...(input.widthMm != null ? { widthMm: input.widthMm } : {}),
    start: { purlinId: input.startPurlinId, face },
    end: { kind: 'outer-contour' },
  }
}

/** Distance along stack from the straight (or chosen) outer side to the beam axis (mm). */
export function supportBeamAxisFromSideMm(
  beam: StraightSupportBeam,
  contour: Point2D[],
  from?: 'min-stack' | 'max-stack',
  frameHalfMm = 0,
): number {
  const dirDeg = beam.directionDeg ?? 90
  const rad = (dirDeg * Math.PI) / 180
  const dir: Point2D = [Math.cos(rad), Math.sin(rad)]
  const stack: Point2D = [-dir[1], dir[0]]
  const side = from ?? straightSideStackExtreme(contour, dirDeg)
  const { minS, maxS } = stackBounds(contour, stack, frameHalfMm)
  const axisStack = beam.anchorMm.x * stack[0] + beam.anchorMm.y * stack[1]
  return side === 'min-stack' ? axisStack - minS : maxS - axisStack
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

export type SupportBeamWarningCode =
  | 'unknown-format'
  | 'empty-beams'
  | 'purlin-missing'
  | 'not-resolved'
  | 'anchor-outside'

export interface SupportBeamWarning {
  code: SupportBeamWarningCode
  beamId?: string
  /** Human-readable reason (Russian host may translate by code). */
  message: string
}

/**
 * Diagnose stored supportBeams without mutating them.
 * Invalid / unresolved beams → warnings; calculation simply omits them.
 */
export function diagnoseSupportBeams(input: {
  raw: unknown
  spec: PergolaSpec
  profiles: Map<string, ProfileDimensions>
}): SupportBeamWarning[] {
  const { raw, spec, profiles } = input
  if (raw == null) return []
  if (typeof raw !== 'object') {
    return [{ code: 'unknown-format', message: 'Опорная балка не учтена: неверный формат данных' }]
  }
  const o = raw as Record<string, unknown>
  if (o.formatVersion !== SUPPORT_BEAMS_FORMAT_VERSION) {
    return [{
      code: 'unknown-format',
      message: `Опорная балка не учтена: неизвестная версия формата (${String(o.formatVersion)})`,
    }]
  }
  if (!Array.isArray(o.beams) || o.beams.length === 0) {
    return [{ code: 'empty-beams', message: 'Опорная балка не учтена: список балок пуст' }]
  }
  const doc = parseSupportBeamsDocument(raw)
  const lines = spec.purlinDividers?.mode === 'manual' ? spec.purlinDividers.lines ?? [] : []
  const lineIds = new Set(lines.map((l) => l.id))
  const warnings: SupportBeamWarning[] = []
  for (const item of o.beams) {
    if (!item || typeof item !== 'object') {
      warnings.push({ code: 'unknown-format', message: 'Опорная балка не учтена: повреждённая запись балки' })
      continue
    }
    const b = item as Record<string, unknown>
    const id = typeof b.id === 'string' ? b.id : undefined
    const purlinId =
      b.start && typeof b.start === 'object'
        ? (b.start as { purlinId?: unknown }).purlinId
        : undefined
    if (typeof purlinId === 'string' && !lineIds.has(purlinId)) {
      warnings.push({
        code: 'purlin-missing',
        beamId: id,
        message: `Опорная балка не учтена: поперечина «${purlinId}» не найдена (переименована или удалена)`,
      })
    }
  }
  if (!doc) {
    if (warnings.length === 0) {
      warnings.push({
        code: 'unknown-format',
        message: 'Опорная балка не учтена: данные балки не удалось разобрать',
      })
    }
    return warnings
  }
  const resolved = resolveStraightSupportBeams({ ...spec, supportBeams: doc }, profiles)
  const resolvedIds = new Set(resolved.map((r) => r.id))
  for (const beam of doc.beams) {
    if (resolvedIds.has(beam.id)) continue
    if (warnings.some((w) => w.beamId === beam.id && w.code === 'purlin-missing')) continue
    const inside = pointInPolygonApprox([beam.anchorMm.x, beam.anchorMm.y], spec.contour)
    warnings.push({
      code: inside ? 'not-resolved' : 'anchor-outside',
      beamId: beam.id,
      message: inside
        ? `Опорная балка не учтена: не удалось построить геометрию «${beam.id}» (нет пересечения с контуром)`
        : `Опорная балка не учтена: якорь «${beam.id}» вне контура`,
    })
  }
  return warnings
}

function pointInPolygonApprox(p: Point2D, poly: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi + 1e-15) + xi) {
      inside = !inside
    }
  }
  return inside
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
