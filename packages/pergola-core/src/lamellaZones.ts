/**
 * Lamella zones: a part of the contour with its own lamella and divider
 * direction.
 *
 * Why this exists. `lamellaDirectionDeg` is one scalar for the whole plan and
 * every divider is square to it. A slanted wing next to a long strip cannot be
 * built that way: the lamellas must follow one slanted side while the dividers
 * follow another, so the sections are parallelograms.
 *
 * What a zone is. The contour is cut by the line through one contour edge
 * (`cutEdgeIndex`, extended until it leaves the contour). The part on the side
 * of `dividerEdgeIndex` is the zone, the rest stays with the plan-wide
 * direction (and goes through the unchanged pipeline). Nothing is stored in
 * coordinates, so the zone follows the geometry when vertices move.
 *
 * Zone geometry. With ℓ = unit direction of the lamella edge, n = its left
 * normal and d = unit direction of the divider edge (d·n > 0), a plan point p
 * maps to sheared coordinates
 *
 *     x = p·ℓ − (p·n)·cot γ      (position along a lamella row)
 *     y = p·n                    (row position, pitch is the true pitch)
 *
 * where γ is the angle between ℓ and d. A divider is a line of constant x, a
 * lamella row is a line of constant y, and every section is an axis-aligned
 * rectangle in (x, y). The plan shapes follow from the inverse map
 * p = x·ℓ + (y / sin γ)·d: lamella length = Δx, divider length = Δy / sin γ,
 * divider width along ℓ = w / sin γ.
 *
 * Assumptions (not hardcoded numbers, but conventions):
 *  - flat roof only (a sloped roof throws);
 *  - auto dividers only inside a zone (manual lines keep applying to the rest);
 *  - the zone is inset along the cut line by the cut edge's beam inset; the
 *    rest of the contour keeps a standard frame beam on that line (taken from
 *    the frame of the remainder), so there is one beam line between zones.
 */

import type {
  CutPiece,
  LamellaZone,
  PergolaSpec,
  Point2D,
  ProfileDimensions,
  Vector2D,
} from './types'
import { contourSideWidthMm, DIVIDER_PLAN_CLEARANCE_WIDTH_MM } from './beamPlanWidth'
import { sanitizeContour } from './contourSanitize'
import { edgeIndicesInCcwOrder, edgeValuesInCcwOrder, isCCW } from './miter'
import { autoPurlinSpanCount, resolveContourReference } from './lamellaSpans'
import { patternMaxLamellaSpanMm, patternMaxVerticalThicknessMm, resolveLamellaPattern } from './lamellaPattern'
import { cutAtEdge, longPointOffset, scanLineClip } from './lamellas'
import { isHorizontalPlane, roofPlane, type RoofPlane } from './roof'
import {
  buildLamellaSectionsCore,
  countRowsInHeight,
  factorySectionSizeMm,
  floorLamellaLengthMm,
  LAMELLA_SECTION_CLEARANCE_W_MM,
  LAMELLA_TIP_MIN_LENGTH_MM,
  representativePitchMm,
  type BuildLamellaSectionsOptions,
  type LamellaSection,
} from './lamellaSections'
import { computeFrame } from './frame'
import { pieceAxis } from './pieceAxis'
import { specColorHex } from './support'

const RAD = Math.PI / 180
const DEG = 180 / Math.PI
/** Distance below which a point counts as lying on a line, mm. */
const ON_LINE_MM = 0.01
/** Zone directions closer than this to each other are rejected, degrees. */
const MIN_CROSS_ANGLE_DEG = 5
const MIN_SEGMENT_MM = 1
/** A remainder frame piece this close to the full frame's post is a duplicate. */
const POST_DUPLICATE_MM = 300

// ── small vector helpers ─────────────────────────────────────────────────────

function dot(a: Vector2D, b: Vector2D): number {
  return a[0] * b[0] + a[1] * b[1]
}
function cross(a: Vector2D, b: Vector2D): number {
  return a[0] * b[1] - a[1] * b[0]
}
function unit(a: Point2D, b: Point2D): Vector2D {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  return len < 1e-12 ? [0, 0] : [dx / len, dy / len]
}
function leftNormal(u: Vector2D): Vector2D {
  return [-u[1], u[0]]
}

// ── contour clipping with edge-origin tracking ───────────────────────────────

/** Vertex of a polygon plus the origin of its OUTGOING edge (`null` = cut line). */
interface Vertex {
  p: Point2D
  origin: number | null
}

/**
 * Keep the part of a polygon where `side(p) >= 0`. Edges that lie on the clip
 * line get origin `null` unless they were already an edge of the polygon (then
 * they keep their origin, so a contour edge lying on the cut line stays a
 * contour edge).
 */
function clipHalfPlane(poly: Vertex[], side: (p: Point2D) => number): Vertex[] {
  const out: Vertex[] = []
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const sa = side(a.p)
    const sb = side(b.p)
    const aIn = sa >= -ON_LINE_MM
    const bIn = sb >= -ON_LINE_MM
    if (aIn && bIn) {
      out.push(a)
    } else if (aIn && !bIn) {
      if (Math.abs(sa) <= ON_LINE_MM) {
        out.push({ p: a.p, origin: null })
      } else {
        const t = sa / (sa - sb)
        out.push(a)
        out.push({ p: [a.p[0] + t * (b.p[0] - a.p[0]), a.p[1] + t * (b.p[1] - a.p[1])], origin: null })
      }
    } else if (!aIn && bIn && Math.abs(sb) > ON_LINE_MM) {
      const t = sa / (sa - sb)
      out.push({ p: [a.p[0] + t * (b.p[0] - a.p[0]), a.p[1] + t * (b.p[1] - a.p[1])], origin: a.origin })
    }
  }
  // Drop consecutive duplicates (their zero-length edge has no meaning).
  const cleaned: Vertex[] = []
  for (const v of out) {
    const prev = cleaned[cleaned.length - 1]
    if (prev && Math.hypot(prev.p[0] - v.p[0], prev.p[1] - v.p[1]) < ON_LINE_MM) continue
    cleaned.push(v)
  }
  while (
    cleaned.length > 1 &&
    Math.hypot(cleaned[0].p[0] - cleaned[cleaned.length - 1].p[0], cleaned[0].p[1] - cleaned[cleaned.length - 1].p[1]) <
      ON_LINE_MM
  ) {
    cleaned.pop()
  }
  return removeSpikes(cleaned)
}

/**
 * Drop a vertex whose two edges run back over each other (zero-area spike).
 * It appears when a contour edge lies on the clip line: the clipped outline then
 * walks that edge and comes straight back along the closing edge.
 */
function removeSpikes(poly: Vertex[]): Vertex[] {
  const out = [...poly]
  let changed = true
  while (changed && out.length >= 3) {
    changed = false
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length].p
      const v = out[i].p
      const b = out[(i + 1) % out.length].p
      const e1: Vector2D = [v[0] - a[0], v[1] - a[1]]
      const e2: Vector2D = [b[0] - v[0], b[1] - v[1]]
      const scale = Math.hypot(e1[0], e1[1]) * Math.hypot(e2[0], e2[1])
      if (scale > 0 && Math.abs(cross(e1, e2)) <= 1e-9 * scale && dot(e1, e2) < 0) {
        out.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return out
}

function polygonArea(pts: Point2D[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

function isConvex(pts: Point2D[]): boolean {
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const c = pts[(i + 2) % n]
    if (cross([b[0] - a[0], b[1] - a[1]], [c[0] - b[0], c[1] - b[1]]) < -1e-6) return false
  }
  return true
}

// ── zone resolution ──────────────────────────────────────────────────────────

/** Sheared frame of a zone (see the file header). */
export interface ZoneFrame {
  /** Unit direction of the lamellas. */
  lamellaDir: Vector2D
  /** Left normal of `lamellaDir`. */
  normal: Vector2D
  /** Unit direction of the dividers, oriented so that `dividerDir·normal > 0`. */
  dividerDir: Vector2D
  /** Angle between lamellas and dividers, degrees, in (0, 90]. */
  crossAngleDeg: number
  sinGamma: number
  cosGamma: number
}

export interface ResolvedLamellaZone {
  zone: LamellaZone
  /** CCW zone outline, plan mm. Collinear vertices are kept on purpose. */
  polygon: Point2D[]
  /** Contour edge index (CCW numbering) behind each polygon edge; `null` = cut line. */
  edgeOrigin: Array<number | null>
  frame: ZoneFrame
  /** The cut line as seen from the zone, a segment of the zone outline. */
  cutSegment: [Point2D, Point2D]
}

export interface LamellaZoneSplit {
  /** Remainder outline (CCW); `null` when the zones cover the whole contour. */
  remainder: Vertex[] | null
  zones: ResolvedLamellaZone[]
  /** Sanitised CCW contour all indices refer to. */
  ccw: Point2D[]
  /** Edge indices given by the user, converted to the CCW numbering. */
  toCcwIndex: (drawnIndex: number) => number
}

/**
 * Build the sheared frame from two contour edges.
 * Throws when the two directions are (nearly) parallel: the zone would have no area per row.
 */
export function zoneFrameFromEdges(
  ccw: Point2D[],
  lamellaEdgeCcw: number,
  dividerEdgeCcw: number,
): ZoneFrame {
  const n = ccw.length
  let ell = unit(ccw[lamellaEdgeCcw], ccw[(lamellaEdgeCcw + 1) % n])
  // Orient ℓ into (-90°, 90°] so the output does not depend on the winding.
  if (ell[0] < -1e-9 || (Math.abs(ell[0]) <= 1e-9 && ell[1] < 0)) ell = [-ell[0], -ell[1]]
  const normal = leftNormal(ell)
  let div = unit(ccw[dividerEdgeCcw], ccw[(dividerEdgeCcw + 1) % n])
  if (dot(div, normal) < 0) div = [-div[0], -div[1]]
  const sinGamma = dot(div, normal)
  if (sinGamma < Math.sin(MIN_CROSS_ANGLE_DEG * RAD)) {
    throw new Error('lamellaZones: lamella edge and divider edge are parallel')
  }
  const cosGamma = dot(div, ell)
  return {
    lamellaDir: ell,
    normal,
    dividerDir: div,
    crossAngleDeg: Math.atan2(sinGamma, Math.abs(cosGamma)) * DEG,
    sinGamma,
    cosGamma,
  }
}

function toSheared(f: ZoneFrame, p: Point2D): Point2D {
  const along = dot(p, f.lamellaDir)
  const across = dot(p, f.normal)
  return [along - (across * f.cosGamma) / f.sinGamma, across]
}

function fromSheared(f: ZoneFrame, q: Point2D): Point2D {
  const k = q[1] / f.sinGamma
  return [q[0] * f.lamellaDir[0] + k * f.dividerDir[0], q[0] * f.lamellaDir[1] + k * f.dividerDir[1]]
}

/**
 * Split a contour into zones and the remainder. Pure geometry — no profiles.
 * Edge indices in `zones` count on `sanitizeContour(contour)` as drawn.
 */
export function splitContourByLamellaZones(contour: Point2D[], zones: LamellaZone[]): LamellaZoneSplit {
  const clean = sanitizeContour(contour)
  const ccw = isCCW(clean) ? clean : [...clean].reverse()
  const n = ccw.length
  const toCcwIndex = (drawn: number): number => edgeIndicesInCcwOrder(clean, [drawn])?.[0] ?? drawn
  const checkIndex = (zone: LamellaZone, field: keyof LamellaZone, drawn: number): number => {
    if (!Number.isInteger(drawn) || drawn < 0 || drawn >= n) {
      throw new Error(`lamellaZones: zone "${zone.id}" ${String(field)} ${drawn} is not an edge of the contour`)
    }
    return toCcwIndex(drawn)
  }

  let rest: Vertex[] | null = ccw.map((p, i) => ({ p, origin: i }))
  const resolved: ResolvedLamellaZone[] = []

  for (const zone of zones) {
    if (rest == null) throw new Error(`lamellaZones: zone "${zone.id}" has no contour left`)
    const cutIdx = checkIndex(zone, 'cutEdgeIndex', zone.cutEdgeIndex)
    const lamIdx = checkIndex(zone, 'lamellaEdgeIndex', zone.lamellaEdgeIndex)
    const divIdx = checkIndex(zone, 'dividerEdgeIndex', zone.dividerEdgeIndex)
    const frame = zoneFrameFromEdges(ccw, lamIdx, divIdx)

    const a = ccw[cutIdx]
    const b = ccw[(cutIdx + 1) % n]
    const cutDir = unit(a, b)
    const cutSide = (p: Point2D): number => cross(cutDir, [p[0] - a[0], p[1] - a[1]])
    const mid = (i: number): Point2D => {
      const p = ccw[i]
      const q = ccw[(i + 1) % n]
      return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
    }
    // The zone is on the side that holds the divider edge, else the lamella edge.
    let sign = Math.sign(cutSide(mid(divIdx)))
    if (Math.abs(cutSide(mid(divIdx))) <= ON_LINE_MM) sign = Math.sign(cutSide(mid(lamIdx)))
    if (sign === 0) {
      throw new Error(`lamellaZones: zone "${zone.id}" divider and lamella edges lie on its cut line`)
    }

    const zoneVerts = clipHalfPlane(rest, (p) => sign * cutSide(p))
    const restVerts = clipHalfPlane(rest, (p) => -sign * cutSide(p))
    if (zoneVerts.length < 3 || Math.abs(polygonArea(zoneVerts.map((v) => v.p))) < 1) {
      throw new Error(`lamellaZones: zone "${zone.id}" is empty`)
    }
    if (!isConvex(zoneVerts.map((v) => v.p))) {
      throw new Error(`lamellaZones: zone "${zone.id}" is not convex; cut it with another line first`)
    }
    const polygon = zoneVerts.map((v) => v.p)
    const edgeOrigin = zoneVerts.map((v) => v.origin)
    // Cut line seen from the zone: the span of the vertices lying on it.
    const onCut = polygon.filter((p) => Math.abs(cutSide(p)) <= ON_LINE_MM)
    if (onCut.length < 2) throw new Error(`lamellaZones: zone "${zone.id}" does not touch its cut line`)
    const along = (p: Point2D): number => dot(cutDir, [p[0] - a[0], p[1] - a[1]])
    const sorted = [...onCut].sort((p, q) => along(p) - along(q))
    resolved.push({
      zone,
      polygon,
      edgeOrigin,
      frame,
      cutSegment: [sorted[0], sorted[sorted.length - 1]],
    })
    rest =
      restVerts.length >= 3 && Math.abs(polygonArea(restVerts.map((v) => v.p))) >= 1 ? restVerts : null
    // Keep the winding: clipping a CCW polygon with half-planes preserves it.
  }
  return { remainder: rest, zones: resolved, ccw, toCcwIndex }
}

// ── zone layout ──────────────────────────────────────────────────────────────

export interface LamellaZoneLayout {
  zoneId: string
  sections: LamellaSection[]
  lamellas: CutPiece[]
  purlins: CutPiece[]
  /** Sections that were dropped because a side is ≤ 0 or no row fits. */
  skipped: Array<{ id: string; reason: string }>
}

export interface LamellaZonePlan {
  /** Spec for the part outside every zone; `null` when the zones cover the contour. */
  mainSpec: PergolaSpec | null
  zoneLayouts: LamellaZoneLayout[]
  /** Frame pieces on the cut lines that the full frame does not have. */
  junctionBeams: CutPiece[]
  junctionPosts: CutPiece[]
  split: LamellaZoneSplit
}

/**
 * Read `lamellaZones` from untrusted JSON (saved plan, API body, pasted export).
 * An entry needs a non-empty string `id` and three non-negative integer edge
 * numbers; anything else is skipped. Returns `undefined` when nothing valid is
 * left, so the field disappears instead of becoming an empty list.
 */
export function parseLamellaZones(raw: unknown): LamellaZone[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const isEdge = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
  const zones: LamellaZone[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue
    const z = item as Record<string, unknown>
    if (typeof z.id !== 'string' || z.id.length === 0 || seen.has(z.id)) continue
    if (!isEdge(z.cutEdgeIndex) || !isEdge(z.lamellaEdgeIndex) || !isEdge(z.dividerEdgeIndex)) continue
    seen.add(z.id)
    zones.push({
      id: z.id,
      cutEdgeIndex: z.cutEdgeIndex,
      lamellaEdgeIndex: z.lamellaEdgeIndex,
      dividerEdgeIndex: z.dividerEdgeIndex,
    })
  }
  return zones.length > 0 ? zones : undefined
}

export function hasLamellaZones(spec: Pick<PergolaSpec, 'lamellaZones'>): boolean {
  return spec.lamellaZones != null && spec.lamellaZones.length > 0
}

export interface LamellaZoneIssue {
  zoneId: string
  /** Why the zone cannot be built; the text comes from the geometry check. */
  message: string
}

export interface CheckedLamellaZones {
  /** Zones that can be built, in order; zones are tried one after another. */
  applicable: LamellaZone[]
  /** One entry per zone that was left out. */
  issues: LamellaZoneIssue[]
}

/**
 * The pipeline throws on a zone that cannot be built (parallel edges, an edge that is
 * not on the contour, a non-convex cut). An editor lets the user pick any edges, so it
 * checks first: each zone is tried on top of the ones before it, and a failing zone is
 * reported with its reason instead of being passed on.
 */
export function checkLamellaZones(contour: Point2D[], zones: LamellaZone[]): CheckedLamellaZones {
  const applicable: LamellaZone[] = []
  const issues: LamellaZoneIssue[] = []
  for (const zone of zones) {
    const attempt = [...applicable, zone]
    try {
      const split = splitContourByLamellaZones(contour, attempt)
      const built = split.zones.find((resolved) => resolved.zone.id === zone.id)
      if (built == null) throw new Error(`lamellaZones: zone "${zone.id}" was not resolved`)
      applicable.push(zone)
    } catch (error) {
      issues.push({ zoneId: zone.id, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { applicable, issues }
}

export interface LamellaDirectionArrow {
  /** Zone id, or `null` for the part outside every zone. */
  zoneId: string | null
  /** Plan point (mm) the arrow is centred on. */
  center: Point2D
  /** Unit direction of the lamellas. */
  direction: [number, number]
}

function polygonCentroid(poly: Array<readonly [number, number]>): Point2D {
  let area2 = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = a[0] * b[1] - b[0] * a[1]
    area2 += cross
    cx += (a[0] + b[0]) * cross
    cy += (a[1] + b[1]) * cross
  }
  if (Math.abs(area2) < 1e-6) {
    const n = poly.length
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * area2), cy / (3 * area2)]
}

/**
 * One lamella-direction arrow per area: each zone gets its own, and the part outside
 * the zones gets the plan-wide direction. Zones that cannot be built are skipped, as in
 * the build. Without zones the single arrow sits at the contour centroid.
 */
export function lamellaDirectionArrows(
  contour: Point2D[],
  zones: LamellaZone[] | undefined,
  planDirectionDeg: number,
): LamellaDirectionArrow[] {
  const theta = (planDirectionDeg * Math.PI) / 180
  const planDirection: [number, number] = [Math.cos(theta), Math.sin(theta)]
  const { applicable } = checkLamellaZones(contour, zones ?? [])
  if (applicable.length === 0) {
    return [{ zoneId: null, center: polygonCentroid(contour), direction: planDirection }]
  }
  const split = splitContourByLamellaZones(contour, applicable)
  const arrows: LamellaDirectionArrow[] = split.zones.map((resolved) => ({
    zoneId: resolved.zone.id,
    center: polygonCentroid(resolved.polygon),
    direction: [resolved.frame.lamellaDir[0], resolved.frame.lamellaDir[1]],
  }))
  if (split.remainder != null) {
    arrows.push({
      zoneId: null,
      center: polygonCentroid(split.remainder.map((v) => v.p)),
      direction: planDirection,
    })
  }
  return arrows
}

/** x-range of a convex polygon at height y (sheared coordinates), or null. */
function xSpanAt(poly: Point2D[], y: number): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const y0 = Math.min(a[1], b[1])
    const y1 = Math.max(a[1], b[1])
    if (y < y0 - 1e-9 || y > y1 + 1e-9) continue
    if (Math.abs(b[1] - a[1]) < 1e-12) {
      lo = Math.min(lo, a[0], b[0])
      hi = Math.max(hi, a[0], b[0])
    } else {
      const t = (y - a[1]) / (b[1] - a[1])
      const x = a[0] + t * (b[0] - a[0])
      lo = Math.min(lo, x)
      hi = Math.max(hi, x)
    }
  }
  return lo <= hi ? [lo, hi] : null
}

/** Usable x-range of a convex polygon over the whole band [y0, y1]. */
function xSpanOverBand(poly: Point2D[], y0: number, y1: number): [number, number] | null {
  const ys = [y0, y1, ...poly.map((p) => p[1]).filter((y) => y > y0 + 1e-9 && y < y1 - 1e-9)]
  let lo = -Infinity
  let hi = Infinity
  for (const y of ys) {
    const span = xSpanAt(poly, y)
    if (span == null) return null
    lo = Math.max(lo, span[0])
    hi = Math.min(hi, span[1])
  }
  return lo < hi ? [lo, hi] : null
}

function clipVerts(poly: Point2D[], side: (p: Point2D) => number): Point2D[] {
  return clipHalfPlane(
    poly.map((p) => ({ p, origin: null })),
    side,
  ).map((v) => v.p)
}

/** Outline offset into the polygon by `insetMm(edgeOrigin)` per edge (convex only). */
function insetPolygon(zone: ResolvedLamellaZone, insetMmByEdge: (i: number) => number): Point2D[] {
  let field: Point2D[] = zone.polygon
  const n = zone.polygon.length
  for (let i = 0; i < n; i++) {
    const a = zone.polygon[i]
    const b = zone.polygon[(i + 1) % n]
    const u = unit(a, b)
    const nrm = leftNormal(u)
    const c = dot(nrm, a) + insetMmByEdge(i)
    field = clipVerts(field, (p) => dot(nrm, p) - c)
    if (field.length < 3) return []
  }
  return field
}

export interface LamellaZoneContext {
  spec: PergolaSpec
  profiles: Map<string, ProfileDimensions>
  split: LamellaZoneSplit
}

/** Layout (sections, lamellas, dividers) of one zone. */
export function buildLamellaZoneLayout(zone: ResolvedLamellaZone, ctx: LamellaZoneContext): LamellaZoneLayout {
  const { spec, profiles, split } = ctx
  const f = zone.frame
  const pattern = resolveLamellaPattern(spec, profiles)
  const gap = spec.lamellaGapMm
  const purlinId = spec.purlinProfileId
  const purlinProfile = purlinId ? profiles.get(purlinId) : undefined
  const tilt = spec.lamellaOnEdge ? spec.lamellaAngleDeg + 90 : spec.lamellaAngleDeg
  const color = specColorHex(spec)
  const walls = edgeIndicesInCcwOrder(sanitizeContour(spec.contour), spec.wallEdgeIndices) ?? []
  const measuredCcw = edgeValuesInCcwOrder(sanitizeContour(spec.contour), spec.measuredOuterLengthMmByEdgeIndex)
  const reference = resolveContourReference({
    contourReference: spec.contourReference,
    contour: split.ccw,
    measured: measuredCcw,
  }).reference
  const cutIdx = split.toCcwIndex(zone.zone.cutEdgeIndex)
  const widthOf = (edgeCcw: number): number =>
    contourSideWidthMm(profiles, edgeCcw, {
      wallEdgeIndices: walls,
      beamProfileId: spec.beamProfileId,
      wallProfileId: spec.wallProfileId,
      wallBeamWidthVersion: spec.wallBeamWidthVersion,
    })
  const insetFactor = reference === 'outer-faces' ? 1 : 0.5
  const insetFor = (i: number): number => widthOf(zone.edgeOrigin[i] ?? cutIdx) * insetFactor

  const layout: LamellaZoneLayout = { zoneId: zone.zone.id, sections: [], lamellas: [], purlins: [], skipped: [] }
  const field = insetPolygon(zone, insetFor)
  if (field.length < 3) {
    layout.skipped.push({ id: `${zone.zone.id}-field`, reason: 'zone has no inner field' })
    return layout
  }
  const fieldS = field.map((p) => toSheared(f, p))
  const polyS = zone.polygon.map((p) => toSheared(f, p))
  const xMin = Math.min(...fieldS.map((p) => p[0]))
  const xMax = Math.max(...fieldS.map((p) => p[0]))
  const polyXMin = Math.min(...polyS.map((p) => p[0]))
  const polyXMax = Math.max(...polyS.map((p) => p[0]))

  // Dividers: same Max rule as the plan-wide pass, measured along the lamellas.
  const dividerWidthX = DIVIDER_PLAN_CLEARANCE_WIDTH_MM / f.sinGamma
  const endWidthX = ((xMin - polyXMin) + (polyXMax - xMax)) / 2
  const fieldLenX = xMax - xMin
  const spanCount = purlinProfile?.interruptsLamella === true
    ? Math.max(
        1,
        autoPurlinSpanCount(fieldLenX + 2 * endWidthX, patternMaxLamellaSpanMm(pattern), endWidthX, dividerWidthX),
      )
    : 1
  const dividerCount = spanCount - 1
  const clearX = (fieldLenX - dividerCount * dividerWidthX) / spanCount
  const dividerCentersX: number[] = []
  for (let k = 1; k <= dividerCount; k++) {
    dividerCentersX.push(xMin + k * clearX + (k - 1) * dividerWidthX + dividerWidthX / 2)
  }

  const crossDeg = f.crossAngleDeg
  const dividerAzimuth = Math.atan2(f.dividerDir[1], f.dividerDir[0])
  const lamellaAzimuth = Math.atan2(f.lamellaDir[1], f.lamellaDir[0])
  const aboveLamellaMm = purlinProfile?.interruptsLamella === true ? 0 : patternMaxVerticalThicknessMm(pattern)
  const baseY = spec.heightMm + aboveLamellaMm
  const pitchMm = representativePitchMm(pattern, gap)

  // Sections: one cell between two neighbouring dividers (or field ends).
  for (let k = 0; k < spanCount; k++) {
    const xa = k === 0 ? xMin : dividerCentersX[k - 1] + dividerWidthX / 2
    const xb = k === spanCount - 1 ? xMax : dividerCentersX[k] - dividerWidthX / 2
    const cell = clipVerts(clipVerts(fieldS, (p) => p[0] - xa), (p) => xb - p[0])
    const secId = `${zone.zone.id}-sec-${k}`
    if (cell.length < 3) {
      layout.skipped.push({ id: secId, reason: 'no cell' })
      continue
    }
    const yLo = Math.min(...cell.map((p) => p[1]))
    const yHi = Math.max(...cell.map((p) => p[1]))
    const { widthMm, heightMm } = factorySectionSizeMm(xb - xa, yHi - yLo)
    if (!(widthMm > 0) || !(heightMm > 0)) {
      layout.skipped.push({ id: secId, reason: `size ${widthMm.toFixed(1)} x ${heightMm.toFixed(1)}` })
      continue
    }
    const rowCount = countRowsInHeight(heightMm, pattern, gap)
    if (rowCount < 1) {
      layout.skipped.push({ id: secId, reason: 'no row fits' })
      continue
    }
    const yRow0 = yLo + (yHi - yLo - heightMm) / 2

    const corners: Point2D[] = [
      fromSheared(f, [xa + LAMELLA_SECTION_CLEARANCE_W_MM / 2, yRow0]),
      fromSheared(f, [xb - LAMELLA_SECTION_CLEARANCE_W_MM / 2, yRow0]),
      fromSheared(f, [xb - LAMELLA_SECTION_CLEARANCE_W_MM / 2, yRow0 + heightMm]),
      fromSheared(f, [xa + LAMELLA_SECTION_CLEARANCE_W_MM / 2, yRow0 + heightMm]),
    ]
    layout.sections.push({
      id: secId,
      widthMm,
      heightMm,
      clearWMm: xb - xa,
      clearHMm: yHi - yLo,
      lamellaCount: rowCount,
      pitchMm,
      minX: Math.min(...corners.map((c) => c[0])),
      maxX: Math.max(...corners.map((c) => c[0])),
      minY: Math.min(...corners.map((c) => c[1])),
      maxY: Math.max(...corners.map((c) => c[1])),
      faceX0: k === 0 ? 'frame' : 'purlin',
      faceX1: k === spanCount - 1 ? 'frame' : 'purlin',
      faceY0: 'frame',
      faceY1: 'frame',
      zoneId: zone.zone.id,
      oblique: {
        lamellaDirectionDeg: lamellaAzimuth * DEG,
        dividerDirectionDeg: dividerAzimuth * DEG,
        crossAngleDeg: crossDeg,
        cutMiterDeg: 90 - crossDeg,
        corners,
      },
    })

    // Lamellas of this cell.
    let scan = pattern[0].visibleWidthMm * 0.5
    let i = 0
    const rows: Array<{ y: number; entry: (typeof pattern)[number]; lo: number; hi: number }> = []
    for (let r = 0; r < rowCount; r++) {
      const entry = pattern[i % pattern.length]
      const next = pattern[(i + 1) % pattern.length]
      const y = yRow0 + scan
      const half = entry.visibleWidthMm * 0.5
      const span = xSpanOverBand(cell, y - half, y + half)
      if (span != null) rows.push({ y, entry, lo: span[0], hi: span[1] })
      scan += half + gap + next.visibleWidthMm * 0.5
      i++
    }
    const uniform = rows.every((row) => Math.abs(row.lo - rows[0].lo) < 0.5 && Math.abs(row.hi - rows[0].hi) < 0.5)
    for (const row of rows) {
      const exact = row.hi - row.lo - LAMELLA_SECTION_CLEARANCE_W_MM
      const length = uniform ? exact : floorLamellaLengthMm(exact, spec.lamellaLengthStepMm)
      if (!(length >= LAMELLA_TIP_MIN_LENGTH_MM)) continue
      const x0 = row.lo + (row.hi - row.lo - length) / 2
      const startPt = fromSheared(f, [x0, row.y])
      const rowAnchor: Point2D = [f.normal[0] * row.y, f.normal[1] * row.y]
      const hits = scanLineClip(f.lamellaDir, f.normal, row.y, rowAnchor, zone.polygon)
      const startEdge = hits[0]?.edgeIndex
      const endEdge = hits[hits.length - 1]?.edgeIndex
      const startCut =
        k === 0 && startEdge != null
          ? cutAtEdge(f.lamellaDir, zone.polygon, startEdge)
          : dividerEndCut(f, +1)
      const endCut =
        k === spanCount - 1 && endEdge != null
          ? cutAtEdge(f.lamellaDir, zone.polygon, endEdge)
          : dividerEndCut(f, -1)
      const dS = longPointOffset(startCut.cutMiterDeg, row.entry.visibleWidthMm)
      const dE = longPointOffset(endCut.cutMiterDeg, row.entry.visibleWidthMm)
      layout.lamellas.push({
        id: `lamella-${zone.zone.id}-${layout.lamellas.length}`,
        role: 'lamella',
        profileId: row.entry.profileId,
        lengthAxisMm: length,
        lengthLongMm: length + dS + dE,
        lengthShortMm: length - dS - dE,
        cutMiterStartDeg: startCut.cutMiterDeg,
        cutBevelStartDeg: tilt,
        cutHandStart: startCut.cutHand,
        cutMiterEndDeg: endCut.cutMiterDeg,
        cutBevelEndDeg: tilt,
        cutHandEnd: endCut.cutHand,
        position: [startPt[0], spec.heightMm, startPt[1]],
        rotation: [tilt * RAD, -lamellaAzimuth, 0],
        color,
      })
    }
  }

  // Dividers: one piece per line, from field edge to field edge.
  if (purlinId && purlinProfile && purlinProfile.interruptsLamella === true) {
    const dividerPerp = leftNormal(f.dividerDir)
    dividerCentersX.forEach((x, k) => {
      const cut = clipVerts(clipVerts(fieldS, (p) => p[0] - (x - 0.01)), (p) => x + 0.01 - p[0])
      if (cut.length < 2) return
      const yLo = Math.min(...cut.map((p) => p[1]))
      const yHi = Math.max(...cut.map((p) => p[1]))
      const p0 = fromSheared(f, [x, yLo])
      const p1 = fromSheared(f, [x, yHi])
      const axisMm = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      if (axisMm < MIN_SEGMENT_MM) return
      const anchor = p0
      const hits = scanLineClip(f.dividerDir, dividerPerp, dot(anchor, dividerPerp), anchor, zone.polygon)
      const startEdge = hits[0]?.edgeIndex
      const endEdge = hits[hits.length - 1]?.edgeIndex
      const startCut = startEdge != null ? cutAtEdge(f.dividerDir, zone.polygon, startEdge) : { cutMiterDeg: 0, cutHand: 'straight' as const }
      const endCut = endEdge != null ? cutAtEdge(f.dividerDir, zone.polygon, endEdge) : { cutMiterDeg: 0, cutHand: 'straight' as const }
      const dS = longPointOffset(startCut.cutMiterDeg, purlinProfile.widthMm)
      const dE = longPointOffset(endCut.cutMiterDeg, purlinProfile.widthMm)
      layout.purlins.push({
        id: `purlin-${zone.zone.id}-${k}`,
        role: 'purlin',
        dividerId: `div-${zone.zone.id}-${k}`,
        clipPlanStart: p0,
        clipPlanEnd: p1,
        profileId: purlinId,
        lengthAxisMm: axisMm,
        lengthLongMm: axisMm + dS + dE,
        lengthShortMm: axisMm - dS - dE,
        cutMiterStartDeg: startCut.cutMiterDeg,
        cutBevelStartDeg: 0,
        cutHandStart: startCut.cutHand,
        cutMiterEndDeg: endCut.cutMiterDeg,
        cutBevelEndDeg: 0,
        cutHandEnd: endCut.cutHand,
        position: [p0[0], baseY, p0[1]],
        rotation: [0, -dividerAzimuth, 0],
        color,
      })
    })
  }
  return layout
}

/**
 * Cut at a lamella end that rests on a divider (parallel to `dividerDir`).
 * `towardLamella` is +1 at the lamella start (interior lies on +ℓ), -1 at its end.
 */
function dividerEndCut(f: ZoneFrame, towardLamella: 1 | -1): { cutMiterDeg: number; cutHand: 'L' | 'R' | 'straight' } {
  const e: Vector2D = dot(leftNormal(f.dividerDir), f.lamellaDir) * towardLamella > 0
    ? f.dividerDir
    : [-f.dividerDir[0], -f.dividerDir[1]]
  return cutAtEdge(f.lamellaDir, [[0, 0], [e[0], e[1]]], 0)
}

// ── whole-plan integration ───────────────────────────────────────────────────

/**
 * Prepare everything `buildPieces` needs when the spec has zones.
 * Returns `null` when it has none, so the unchanged path stays byte-identical.
 */
export function planLamellaZones(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  roof: RoofPlane,
  fullFrame?: { beams: CutPiece[]; posts: CutPiece[] },
): LamellaZonePlan | null {
  if (!hasLamellaZones(spec)) return null
  if (!isHorizontalPlane(roof)) {
    throw new Error('lamellaZones: a zone needs a flat roof')
  }
  const zones = spec.lamellaZones as LamellaZone[]
  const split = splitContourByLamellaZones(spec.contour, zones)
  const ctx: LamellaZoneContext = { spec, profiles, split }
  const zoneLayouts = split.zones.map((zone) => buildLamellaZoneLayout(zone, ctx))

  let mainSpec: PergolaSpec | null = null
  const junctionBeams: CutPiece[] = []
  const junctionPosts: CutPiece[] = []
  if (split.remainder != null) {
    const clean = sanitizeContour(spec.contour)
    const origins = split.remainder.map((v) => v.origin)
    const points = split.remainder.map((v) => v.p)
    const wallsCcw = edgeIndicesInCcwOrder(clean, spec.wallEdgeIndices) ?? []
    const measuredCcw = edgeValuesInCcwOrder(clean, spec.measuredOuterLengthMmByEdgeIndex)
    const n = split.ccw.length
    const wallEdgeIndices = origins.flatMap((o, i) => (o != null && wallsCcw.includes(o) ? [i] : []))
    let measured: Array<number | null> | undefined
    if (measuredCcw != null) {
      measured = origins.map((o, i) => {
        if (o == null) return null
        const full = Math.hypot(
          split.ccw[(o + 1) % n][0] - split.ccw[o][0],
          split.ccw[(o + 1) % n][1] - split.ccw[o][1],
        )
        const kept = Math.hypot(
          points[(i + 1) % points.length][0] - points[i][0],
          points[(i + 1) % points.length][1] - points[i][1],
        )
        return Math.abs(full - kept) <= 1 ? (measuredCcw[o] ?? null) : null
      })
    }
    const { lamellaZones: _zones, measuredOuterLengthMmByEdgeIndex: _measured, ...base } = spec
    mainSpec = {
      ...base,
      contour: points,
      wallEdgeIndices,
      ...(measured != null ? { measuredOuterLengthMmByEdgeIndex: measured } : {}),
    }

    // Beam line on every cut: the remainder frame has it, the full frame does not.
    // Sections-only callers pass no frame and skip this.
    const mainFrame = fullFrame != null ? computeFrame(mainSpec, profiles) : { beams: [], posts: [] }
    const cuts = split.zones.map((z) => z.cutSegment)
    const beamW = profiles.get(spec.beamProfileId)?.widthMm ?? 70
    let seq = 0
    for (const beam of mainFrame.beams) {
      const { start, end } = pieceAxis(beam)
      const onCut = cuts.some(([a, b]) => {
        const u = unit(a, b)
        const dist = (p: Point2D) => Math.abs(cross(u, [p[0] - a[0], p[1] - a[1]]))
        const tol = beamW / 2 + 2
        return dist(start) <= tol && dist(end) <= tol
      })
      if (onCut) junctionBeams.push({ ...beam, id: `beam-junction-${seq++}` })
    }
    seq = 0
    for (const post of mainFrame.posts) {
      const [px, , pz] = post.position
      const dup = (fullFrame?.posts ?? []).some((q) => Math.hypot(q.position[0] - px, q.position[2] - pz) < POST_DUPLICATE_MM)
      const nearCut = cuts.some(([a, b]) => {
        const u = unit(a, b)
        return Math.abs(cross(u, [px - a[0], pz - a[1]])) <= beamW + 2
      })
      if (!dup && nearCut) junctionPosts.push({ ...post, id: `post-junction-${seq++}` })
    }
  }
  return { mainSpec, zoneLayouts, junctionBeams, junctionPosts, split }
}

/**
 * Sections of a spec that has zones: the remainder's sections, then every zone's.
 * Called by `buildLamellaSections` — do not call it for a spec without zones.
 */
export function buildLamellaSectionsWithZones(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  options?: BuildLamellaSectionsOptions,
): LamellaSection[] {
  const plan = planLamellaZones(spec, profiles, roofPlane(spec))
  if (plan == null) return buildLamellaSectionsCore(spec, profiles, options)
  const main = plan.mainSpec != null ? buildLamellaSectionsCore(plan.mainSpec, profiles, options) : []
  return [...main, ...plan.zoneLayouts.flatMap((layout) => layout.sections)]
}
