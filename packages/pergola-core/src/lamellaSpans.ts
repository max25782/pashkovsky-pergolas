/**
 * Shared pure geometry for purlin placement — used by BOTH computePurlins
 * (the purlin CutPieces themselves) and computeLamellas (segmenting a
 * lamella row at the exact same crossings when the purlin profile has
 * interruptsLamella: true). Kept in its own module so neither file has to
 * import the other and the two stay in lockstep by construction, not by
 * convention: a purlin crossing and a lamella segment boundary are always
 * the same number, computed once.
 */

import type { PlanPurlinDividerLine, PlanPurlinDividers, Point2D, ProfileDimensions, PurlinDividerMode } from './types'
import { isCCW } from './miter'
import {
  BEAM_PLAN_WIDTH_FALLBACK_MM,
  DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
  beamPlanWidthForDrawing,
  contourSideWidthMm,
  innerFaceClearMm,
  purlinEndWidthOverrides,
  type WallBeamWidthVersion,
} from './beamPlanWidth'

export interface ResolvedPurlinPosition {
  id: string
  positionMm: number
  /** Put in by the builder (not drawn by the user, not on the equal-clear grid). */
  autoAdded?: true
}

/**
 * Dividers the builder adds itself carry this id prefix. They travel in
 * `purlinDividers.lines` of an auto-mode spec (a saved auto plan never has
 * lines), so every caller of the position resolver sees them unchanged.
 */
export const AUTO_DIVIDER_ID_PREFIX = 'div-auto-'

export function isAutoAddedDividerId(id: string): boolean {
  return id.startsWith(AUTO_DIVIDER_ID_PREFIX)
}

function mergeAutoAddedPositions(
  grid: ResolvedPurlinPosition[],
  lines: Array<Pick<PlanPurlinDividerLine, 'id' | 'positionMm'>> | undefined,
  rangeMinMm: number,
  rangeMaxMm: number,
): ResolvedPurlinPosition[] {
  const extras = (lines ?? [])
    .filter((line) => isAutoAddedDividerId(line.id) && Number.isFinite(line.positionMm))
    .filter((line) => line.positionMm > rangeMinMm + 1 && line.positionMm < rangeMaxMm - 1)
    .map((line): ResolvedPurlinPosition => ({ id: line.id, positionMm: line.positionMm, autoAdded: true }))
  if (extras.length === 0) return grid
  const taken = new Set(grid.map((g) => g.id))
  return [...grid, ...extras.filter((e) => !taken.has(e.id))].sort((a, b) => a.positionMm - b.positionMm)
}

/** New plans: equal clears from entered L_outer. Absent on saved plans = legacy. */
export const PURLIN_CLEAR_LAYOUT_VERSION = 1 as const
export type PurlinClearLayoutVersion = typeof PURLIN_CLEAR_LAYOUT_VERSION

export function isPurlinClearLayoutV1(version: number | undefined): boolean {
  return version === PURLIN_CLEAR_LAYOUT_VERSION
}

/**
 * One function for every clear label (sheet, PDF, overlay).
 * `clear = (L_outer − w_left − w_right − n·w_div) / (n+1)`
 */
export function computeEqualPurlinClearMm(input: {
  outerLengthMm: number
  leftEndWidthMm: number
  rightEndWidthMm: number
  dividerCount: number
  dividerWidthMm?: number
}): number {
  const dividerWidthMm = input.dividerWidthMm ?? DIVIDER_PLAN_CLEARANCE_WIDTH_MM
  const sections = input.dividerCount + 1
  if (sections <= 0) return 0
  return (
    input.outerLengthMm - input.leftEndWidthMm - input.rightEndWidthMm - input.dividerCount * dividerWidthMm
  ) / sections
}

/** Display: one decimal, never a silent integer (1288.9 not 1289 / 1284). */
export function formatPurlinClearLabelMm(mm: number): string {
  return (Math.round(mm * 10) / 10).toFixed(1)
}

/**
 * Inset from an axis-range end to the inner frame face.
 * Contour length ≈ L_outer → vertices are outer (inset = full width).
 * Contour shorter by ≈ (w_left+w_right)/2 → vertices are beam centerlines (inset = w/2).
 */
export function purlinEndInsetMm(
  axisLengthMm: number,
  outerLengthMm: number,
  endWidthMm: number,
): number {
  if (!(endWidthMm > 0)) return 0
  if (Math.abs(outerLengthMm - axisLengthMm) <= 1) return endWidthMm
  return endWidthMm / 2
}

/**
 * Placement and the clear-chain ticks must share this inset.
 * v1, or an explicit L_outer that is longer than the centerline axis
 * (typed midot), uses the axis-vs-outer rule. Unset version + no explicit
 * outer keeps the legacy full-width inset from the axis.
 */
export function resolvePurlinEndInsetMm(input: {
  axisLengthMm: number
  outerLengthMm?: number
  endWidthMm: number
  layoutVersion?: PurlinClearLayoutVersion
  /** True when L_outer came from measured / entered sides, not axis fallback. */
  outerIsExplicit?: boolean
}): number {
  const outer =
    input.outerLengthMm != null && input.outerLengthMm > 0
      ? input.outerLengthMm
      : input.axisLengthMm
  const useEqualClearInset =
    isPurlinClearLayoutV1(input.layoutVersion) ||
    (input.outerIsExplicit === true && Math.abs(outer - input.axisLengthMm) > 1)
  if (!useEqualClearInset) return input.endWidthMm
  return purlinEndInsetMm(input.axisLengthMm, outer, input.endWidthMm)
}

/** Explicit plan field: outer-face tape vertices vs beam centerlines. */
export type ContourReference = 'outer-faces' | 'centerline'

export interface ContourReferenceResolution {
  reference: ContourReference
  /** `explicit` = plan.params.contourReference; else heuristic / default. */
  source: 'explicit' | 'heuristic' | 'default'
  /**
   * Heuristic saw mixed signals (some outers ≈ edge, some longer). Editor may
   * show a warning; insets still follow `reference` (longer ⇒ centerline).
   */
  ambiguous: boolean
}

/**
 * Whether contour vertices sit on outer faces (tape) rather than beam centerlines.
 * Any typed outer longer than its edge ⇒ centerline polygon (axis built from outers).
 * Every present outer matching its edge ⇒ outer-face polygon (house / quick-offer).
 * Mixed delta-0 centerline edges are outer≈axis by length alone — the longer edges
 * on the same plan disambiguate; do not decide per-edge.
 *
 * Prefer `resolveContourReference` when `contourReference` may be set — this
 * helper is the unset-field heuristic only.
 */
export function contourVerticesAreOuterFaces(
  contour: Point2D[],
  measured: Array<number | null | undefined> | undefined,
): boolean {
  return resolveContourReference({ contour, measured }).reference === 'outer-faces'
}

/**
 * Decide outer-faces vs centerline for insets / trim / section span.
 * Explicit `contourReference` wins and is never flipped by a profile-width change.
 * Unset ⇒ length heuristic (same as pre-field behavior).
 */
export function resolveContourReference(input: {
  contourReference?: ContourReference | null
  contour: Point2D[]
  measured?: Array<number | null | undefined>
}): ContourReferenceResolution {
  if (input.contourReference === 'outer-faces' || input.contourReference === 'centerline') {
    return { reference: input.contourReference, source: 'explicit', ambiguous: false }
  }
  const { contour, measured } = input
  if (contour.length < 2 || measured == null) {
    return { reference: 'centerline', source: 'default', ambiguous: false }
  }
  let anyMeasured = false
  let anyLonger = false
  let anyEqual = false
  let anyShorter = false
  for (let i = 0; i < contour.length; i++) {
    const outer = measured[i]
    if (outer == null || !(outer > 0)) continue
    anyMeasured = true
    const a = contour[i]
    const b = contour[(i + 1) % contour.length]
    const edgeLen = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (outer > edgeLen + 1) anyLonger = true
    else if (Math.abs(outer - edgeLen) <= 1) anyEqual = true
    else if (outer < edgeLen - 1) anyShorter = true
  }
  if (!anyMeasured) return { reference: 'centerline', source: 'default', ambiguous: false }
  if (anyLonger) {
    return {
      reference: 'centerline',
      source: 'heuristic',
      ambiguous: anyEqual || anyShorter,
    }
  }
  if (anyEqual) {
    return {
      reference: 'outer-faces',
      source: 'heuristic',
      ambiguous: anyShorter,
    }
  }
  return { reference: 'centerline', source: 'default', ambiguous: true }
}

/**
 * Persist the rule that currently applies so a later measured array cannot
 * flip centerline ↔ outer-faces on resave. Explicit CR is left unchanged.
 * Call with the params **before** merging newly invented measured values.
 */
export function pinContourReferenceOnParams<T extends {
  contourReference?: ContourReference | null
  measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
}>(
  contour: Point2D[],
  params: T,
): T & { contourReference: ContourReference } {
  if (params.contourReference === 'outer-faces' || params.contourReference === 'centerline') {
    return { ...params, contourReference: params.contourReference }
  }
  const { reference } = resolveContourReference({
    contour,
    measured: params.measuredOuterLengthMmByEdgeIndex,
  })
  return { ...params, contourReference: reference }
}

/**
 * Axis → polygon-interior face of a frame beam.
 * Outer-face contour + typed L_outer ⇒ full plan width inward.
 * Centerline contour (or v1 with no typed outer) ⇒ half width.
 */
export function axisToInnerFaceMm(input: {
  planWidthMm: number
  axisLengthMm: number
  outerLengthMm?: number | null
  layoutVersion?: PurlinClearLayoutVersion
  outerIsExplicit?: boolean
  /** Whole-contour verdict from `contourVerticesAreOuterFaces`. */
  contourIsOuter?: boolean
}): number {
  const w = input.planWidthMm
  if (!(w > 0)) return 0
  if (input.contourIsOuter === true) return w
  if (input.contourIsOuter === false) return w / 2
  const explicit =
    input.outerIsExplicit === true &&
    input.outerLengthMm != null &&
    input.outerLengthMm > 0
  // v1 with no typed outer: contour is the centerline (see resolvePurlinPositionsMm).
  if (isPurlinClearLayoutV1(input.layoutVersion) && !explicit) return w / 2
  if (!explicit) return w / 2
  return resolvePurlinEndInsetMm({
    axisLengthMm: input.axisLengthMm,
    outerLengthMm: input.outerLengthMm ?? undefined,
    endWidthMm: w,
    layoutVersion: input.layoutVersion,
    outerIsExplicit: explicit,
  })
}

/**
 * Count of equal clear spans for auto purlins. Starts at `ceil(L_outer / maxSpanMm)`
 * (Max count rule). Max equal-clear placement then moves the two end dividers
 * inward, so the end *cut* is `w_end + clear + w_div/2` — that can exceed
 * `maxSpanMm` by ~10–20 mm even when `ceil(L/maxSpan)` is used. Extra spans
 * are added only until that end cut fits. Midot 8000 / 1500 / 40 already fits
 * at 6 spans, so the user's (L − 80 − 5×40) / 6 formula is unchanged.
 */
export function autoPurlinSpanCount(
  outerLengthMm: number,
  maxSpanMm: number | undefined,
  endBeamPlanWidthMm: number = BEAM_PLAN_WIDTH_FALLBACK_MM,
  dividerWidthMm: number = DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
): number {
  if (maxSpanMm == null || !(maxSpanMm > 0) || !(outerLengthMm > 0)) return 0
  if (outerLengthMm <= maxSpanMm) return 1
  let nSpans = Math.ceil(outerLengthMm / maxSpanMm)
  while (nSpans < 128) {
    const clear = computeMaxEqualPurlinClearGapMm(
      outerLengthMm,
      endBeamPlanWidthMm,
      nSpans - 1,
      dividerWidthMm,
    )
    const endPieceMm = endBeamPlanWidthMm + clear + dividerWidthMm / 2
    if (endPieceMm <= maxSpanMm + 1e-6) return nSpans
    nSpans += 1
  }
  return nSpans
}

/**
 * Max rule when both ends share a plan width.
 * Delegates to `computeEqualPurlinClearMm` — do not recompute from axes.
 */
export function computeMaxEqualPurlinClearGapMm(
  outerLengthMm: number,
  endBeamPlanWidthMm: number,
  dividerCount: number,
  dividerWidthMm: number = DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
): number {
  if (dividerCount < 0) return 0
  return computeEqualPurlinClearMm({
    outerLengthMm,
    leftEndWidthMm: endBeamPlanWidthMm,
    rightEndWidthMm: endBeamPlanWidthMm,
    dividerCount,
    dividerWidthMm,
  })
}

/** Divider axis positions that yield equal Max-rule clears on [rangeMin, rangeMax]. */
export function dividerPositionsForMaxEqualClears(input: {
  rangeMinMm: number
  rangeMaxMm: number
  outerLengthMm: number
  endBeamPlanWidthMm: number
  dividerCount: number
  dividerWidthMm?: number
  /** Distance from axis-range end to inner frame face. Default = full end width (legacy). */
  endInsetMm?: number
  leftEndWidthMm?: number
  rightEndWidthMm?: number
  idPrefix?: string
}): ResolvedPurlinPosition[] {
  const dividerWidthMm = input.dividerWidthMm ?? DIVIDER_PLAN_CLEARANCE_WIDTH_MM
  const { rangeMinMm, endBeamPlanWidthMm, dividerCount, idPrefix = 'div' } = input
  if (dividerCount <= 0) return []
  const leftEndWidthMm = input.leftEndWidthMm ?? endBeamPlanWidthMm
  const rightEndWidthMm = input.rightEndWidthMm ?? endBeamPlanWidthMm
  const clear = computeEqualPurlinClearMm({
    outerLengthMm: input.outerLengthMm,
    leftEndWidthMm,
    rightEndWidthMm,
    dividerCount,
    dividerWidthMm,
  })
  const endInsetMm = input.endInsetMm ?? endBeamPlanWidthMm
  const innerStart = rangeMinMm + endInsetMm
  const out: ResolvedPurlinPosition[] = []
  for (let k = 1; k <= dividerCount; k++) {
    const positionMm = innerStart + k * clear + (k - 1) * dividerWidthMm + dividerWidthMm / 2
    out.push({ id: `${idPrefix}-${k}`, positionMm })
  }
  return out
}

/**
 * Axis-even division points (LED / stock helpers). Auto purlin *clears* use
 * `dividerPositionsForMaxEqualClears` instead — even axis steps make the two
 * end bays shorter than the middle by ~w_end/2 each.
 */
export function computeSpanDivisionPointsMm(
  rangeMinMm: number,
  rangeMaxMm: number,
  maxSpanMm: number | undefined,
): number[] {
  if (maxSpanMm == null || !(maxSpanMm > 0)) return []
  const totalLen = rangeMaxMm - rangeMinMm
  if (totalLen <= maxSpanMm) return []

  const nSpans = Math.ceil(totalLen / maxSpanMm)
  const step = totalLen / nSpans
  const points: number[] = []
  for (let k = 1; k < nSpans; k++) points.push(rangeMinMm + k * step)
  return points
}

const EDGE_EPS_MM = 1

/**
 * Shared crossing-line positions for computePurlins and computeLamellas.
 * `auto` (default) = Max equal-clear grid:
 *   (L_outer − 2·w_end − n·w_div) / (n+1)
 * `manual` = persisted lines, clipped to the open interval (rangeMin, rangeMax).
 */
export function resolvePurlinPositionsMm(input: {
  rangeMinMm: number
  rangeMaxMm: number
  maxSpanMm: number | undefined
  mode?: PurlinDividerMode
  lines?: Array<Pick<PlanPurlinDividerLine, 'id' | 'positionMm'>>
  /** Frame beam plan width at the two ends. Default 40 mm. Double-T = 70. */
  endBeamPlanWidthMm?: number
  /** When set, w_left / w_right of `computeEqualPurlinClearMm` (per-side widths). */
  leftEndWidthMm?: number
  rightEndWidthMm?: number
  dividerWidthMm?: number
  /** Entered / measured outer run. Default = axis range. */
  outerLengthMm?: number
  /** `1` = equal-clear from L_outer + correct inset. Unset = legacy full-width inset. */
  layoutVersion?: PurlinClearLayoutVersion
}): ResolvedPurlinPosition[] {
  const mode = input.mode ?? 'auto'
  if (mode === 'manual') {
    const seen = new Set<string>()
    const out: ResolvedPurlinPosition[] = []
    const lines = [...(input.lines ?? [])]
      .filter((line) => Number.isFinite(line.positionMm))
      .filter((line) => line.positionMm > input.rangeMinMm + EDGE_EPS_MM && line.positionMm < input.rangeMaxMm - EDGE_EPS_MM)
      .sort((a, b) => a.positionMm - b.positionMm)
    for (const line of lines) {
      const id = line.id && line.id.length > 0 ? line.id : `div-${Math.round(line.positionMm)}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ id, positionMm: line.positionMm })
    }
    return out
  }

  const axisLengthMm = input.rangeMaxMm - input.rangeMinMm
  const endBeamPlanWidthMm = input.endBeamPlanWidthMm ?? BEAM_PLAN_WIDTH_FALLBACK_MM
  const leftEndWidthMm = input.leftEndWidthMm ?? endBeamPlanWidthMm
  const rightEndWidthMm = input.rightEndWidthMm ?? endBeamPlanWidthMm
  const explicitOuter =
    input.outerLengthMm != null && input.outerLengthMm > 0 ? input.outerLengthMm : undefined
  // No stored L_outer on a v1 plan: the contour is the beam centerline.
  // innerFaceClearMm subtracts half a beam. Passing that opening back as an
  // outer (inner + both full widths) keeps computeEqualPurlinClearMm and the
  // half-width inset on the same length as the shelf.
  const centerlineOuterMm =
    innerFaceClearMm({
      axisLengthMm,
      startWidthMm: leftEndWidthMm,
      endWidthMm: rightEndWidthMm,
    }) + leftEndWidthMm + rightEndWidthMm
  const outerLengthMm = explicitOuter
    ?? (isPurlinClearLayoutV1(input.layoutVersion) ? centerlineOuterMm : axisLengthMm)
  const dividerWidthMm = input.dividerWidthMm ?? DIVIDER_PLAN_CLEARANCE_WIDTH_MM
  const nSpans = autoPurlinSpanCount(
    outerLengthMm,
    input.maxSpanMm,
    Math.max(leftEndWidthMm, rightEndWidthMm),
    dividerWidthMm,
  )
  if (nSpans <= 1) return mergeAutoAddedPositions([], input.lines, input.rangeMinMm, input.rangeMaxMm)
  const endInsetMm = resolvePurlinEndInsetMm({
    axisLengthMm,
    outerLengthMm,
    endWidthMm: leftEndWidthMm,
    layoutVersion: input.layoutVersion,
    outerIsExplicit: input.outerLengthMm != null && input.outerLengthMm > 0,
  })
  return mergeAutoAddedPositions(
    dividerPositionsForMaxEqualClears({
      rangeMinMm: input.rangeMinMm,
      rangeMaxMm: input.rangeMaxMm,
      outerLengthMm,
      endBeamPlanWidthMm: leftEndWidthMm,
      leftEndWidthMm,
      rightEndWidthMm,
      dividerCount: nSpans - 1,
      dividerWidthMm,
      endInsetMm,
    }),
    input.lines,
    input.rangeMinMm,
    input.rangeMaxMm,
  )
}

/** Longest measured outer on a side parallel to the lamellas (L_outer). */
export function measuredOuterAlongLamellas(
  contour: Point2D[],
  lamellaDirectionDeg: number,
  measured: Array<number | null | undefined> | undefined,
): number | undefined {
  if (!measured || contour.length < 2) return undefined
  const θ = (lamellaDirectionDeg * Math.PI) / 180
  const lx = Math.cos(θ)
  const ly = Math.sin(θ)
  let best: number | undefined
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i]
    const b = contour[(i + 1) % contour.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1) continue
    if (Math.abs((dx / len) * lx + (dy / len) * ly) <= 0.98) continue
    const value = measured[i]
    if (typeof value === 'number' && value > 0 && (best == null || value > best)) best = value
  }
  return best
}

export function contourRangeAlongLamellaDir(
  contour: Point2D[],
  lamellaDirectionDeg: number,
): { minMm: number; maxMm: number } {
  const θ = (lamellaDirectionDeg * Math.PI) / 180
  const dir0 = Math.cos(θ)
  const dir1 = Math.sin(θ)
  const projections = contour.map((p) => p[0] * dir0 + p[1] * dir1)
  return { minMm: Math.min(...projections), maxMm: Math.max(...projections) }
}

function unitPoint(dx: number, dy: number): Point2D {
  const len = Math.hypot(dx, dy)
  return len > 1e-9 ? [dx / len, dy / len] : [1, 0]
}

/** Same outward as `contourEdgeOutward`. Kept here so placement does not import the sheet module. */
function edgeOutward(contour: Point2D[], edgeIndex: number): Point2D {
  const n = contour.length
  const a = contour[edgeIndex]
  const b = contour[(edgeIndex + 1) % n]
  const dir = unitPoint(b[0] - a[0], b[1] - a[1])
  const left: Point2D = [-dir[1], dir[0]]
  return isCCW(contour) ? [-left[0], -left[1]] : left
}

/** Outer corner, same construction as `outerVertexAtContourIndex`. */
function outerCorner(contour: Point2D[], vertexIndex: number, halfIn: number, halfOut: number): Point2D {
  const n = contour.length
  const prev = (vertexIndex + n - 1) % n
  const v = contour[vertexIndex]
  const dirIn = unitPoint(v[0] - contour[prev][0], v[1] - contour[prev][1])
  const dirOut = unitPoint(contour[(vertexIndex + 1) % n][0] - v[0], contour[(vertexIndex + 1) % n][1] - v[1])
  const nIn = edgeOutward(contour, prev)
  const nOut = edgeOutward(contour, vertexIndex)
  const p: Point2D = [v[0] + nIn[0] * halfIn, v[1] + nIn[1] * halfIn]
  const q: Point2D = [v[0] + nOut[0] * halfOut, v[1] + nOut[1] * halfOut]
  const den = dirIn[0] * dirOut[1] - dirIn[1] * dirOut[0]
  if (Math.abs(den) < 1e-9) return q
  const t = ((q[0] - p[0]) * dirOut[1] - (q[1] - p[1]) * dirOut[0]) / den
  return [p[0] + dirIn[0] * t, p[1] + dirIn[1] * t]
}

export interface SkewedSideDivisionFrame {
  rangeMinMm: number
  rangeMaxMm: number
  outerLengthMm: number
  leftEndWidthMm: number
  rightEndWidthMm: number
}

/**
 * Equal-clear frame of the longest lamella-parallel side, measured on its
 * outer faces. Returned only when that side is shorter than the contour's
 * projection — a notch or slant sticks out past it. When the side already
 * spans the projection (rectangle, L, the diagonal plan), the caller keeps
 * the projection grid, so those plans do not move.
 */
export function skewedParallelSideDivisionFrame(input: {
  contour: Point2D[]
  lamellaDirectionDeg: number
  edgeWidthMm: (edgeIndex: number) => number
  measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
  layoutVersion?: PurlinClearLayoutVersion
  mode?: PurlinDividerMode
}): SkewedSideDivisionFrame | null {
  if (!isPurlinClearLayoutV1(input.layoutVersion) || input.mode === 'manual') return null
  const contour = input.contour
  const n = contour.length
  if (n < 3) return null
  const rad = (input.lamellaDirectionDeg * Math.PI) / 180
  const lx = Math.cos(rad)
  const ly = Math.sin(rad)
  const project = (point: Point2D) => point[0] * lx + point[1] * ly
  let bboxMin = Infinity
  let bboxMax = -Infinity
  for (const point of contour) {
    const t = project(point)
    if (t < bboxMin) bboxMin = t
    if (t > bboxMax) bboxMax = t
  }
  let best: (SkewedSideDivisionFrame & { axisSpanMm: number }) | null = null
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    const prev = (i + n - 1) % n
    const a = contour[i]
    const b = contour[next]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const edgeLen = Math.hypot(dx, dy)
    if (edgeLen < 1) continue
    if (Math.abs((dx * lx + dy * ly) / edgeLen) <= 0.98) continue
    const widthHere = input.edgeWidthMm(i)
    const o0 = outerCorner(contour, i, input.edgeWidthMm(prev) / 2, widthHere / 2)
    const o1 = outerCorner(contour, next, widthHere / 2, input.edgeWidthMm(next) / 2)
    const measured = input.measuredOuterLengthMmByEdgeIndex?.[i]
    const outerLengthMm = typeof measured === 'number' && measured > 0
      ? measured
      : Math.hypot(o1[0] - o0[0], o1[1] - o0[1])
    const t0 = project(o0)
    const t1 = project(o1)
    const axis0 = project(a)
    const axis1 = project(b)
    const minIsStart = axis0 <= axis1
    const leftEdge = minIsStart ? prev : next
    const rightEdge = minIsStart ? next : prev
    const candidate: SkewedSideDivisionFrame & { axisSpanMm: number } = {
      rangeMinMm: Math.min(t0, t1),
      rangeMaxMm: Math.max(t0, t1),
      outerLengthMm,
      leftEndWidthMm: input.edgeWidthMm(leftEdge),
      rightEndWidthMm: input.edgeWidthMm(rightEdge),
      axisSpanMm: Math.abs(axis1 - axis0),
    }
    if (best == null || candidate.outerLengthMm > best.outerLengthMm) best = candidate
  }
  if (best == null) return null
  if (best.axisSpanMm >= bboxMax - bboxMin - 1) return null
  return {
    rangeMinMm: best.rangeMinMm,
    rangeMaxMm: best.rangeMaxMm,
    outerLengthMm: best.outerLengthMm,
    leftEndWidthMm: best.leftEndWidthMm,
    rightEndWidthMm: best.rightEndWidthMm,
  }
}

/** Purlins, lamellas, sections, and the clear chain share this grid. */
export function resolveContourPurlinPositions(input: {
  contour: Point2D[]
  lamellaDirectionDeg: number
  maxSpanMm: number | undefined
  mode?: PurlinDividerMode
  lines?: Array<Pick<PlanPurlinDividerLine, 'id' | 'positionMm'>>
  profiles: Map<string, ProfileDimensions>
  beamProfileId: string
  wallProfileId?: string
  wallEdgeIndices?: number[]
  wallBeamWidthVersion?: WallBeamWidthVersion
  measuredOuterLengthMmByEdgeIndex?: Array<number | null | undefined>
  layoutVersion?: PurlinClearLayoutVersion
  dividerWidthMm?: number
}): ResolvedPurlinPosition[] {
  const range = contourRangeAlongLamellaDir(input.contour, input.lamellaDirectionDeg)
  const sideInput = {
    wallEdgeIndices: input.wallEdgeIndices,
    beamProfileId: input.beamProfileId,
    wallProfileId: input.wallProfileId,
    wallBeamWidthVersion: input.wallBeamWidthVersion,
  }
  const beamW = beamPlanWidthForDrawing(input.profiles, input.beamProfileId).planWidthMm
  const ends = purlinEndWidthOverrides(input.contour, input.lamellaDirectionDeg, input.profiles, sideInput)
  const frame = skewedParallelSideDivisionFrame({
    contour: input.contour,
    lamellaDirectionDeg: input.lamellaDirectionDeg,
    edgeWidthMm: (index) => contourSideWidthMm(input.profiles, index, sideInput),
    measuredOuterLengthMmByEdgeIndex: input.measuredOuterLengthMmByEdgeIndex,
    layoutVersion: input.layoutVersion,
    mode: input.mode,
  })
  return resolvePurlinPositionsMm({
    rangeMinMm: frame?.rangeMinMm ?? range.minMm,
    rangeMaxMm: frame?.rangeMaxMm ?? range.maxMm,
    maxSpanMm: input.maxSpanMm,
    mode: input.mode,
    lines: input.lines,
    endBeamPlanWidthMm: beamW,
    leftEndWidthMm: frame?.leftEndWidthMm ?? ends?.leftEndWidthMm,
    rightEndWidthMm: frame?.rightEndWidthMm ?? ends?.rightEndWidthMm,
    dividerWidthMm: input.dividerWidthMm,
    outerLengthMm: frame?.outerLengthMm ?? measuredOuterAlongLamellas(
      input.contour,
      input.lamellaDirectionDeg,
      input.measuredOuterLengthMmByEdgeIndex,
    ),
    layoutVersion: input.layoutVersion,
  })
}

export function planPointToDividerPositionMm(
  xMm: number,
  yMm: number,
  lamellaDirectionDeg: number,
): number {
  const θ = (lamellaDirectionDeg * Math.PI) / 180
  return xMm * Math.cos(θ) + yMm * Math.sin(θ)
}

export function beginManualPurlinDividers(
  current: PlanPurlinDividers | undefined,
  rangeMinMm: number,
  rangeMaxMm: number,
  maxSpanMm: number | undefined,
  endBeamPlanWidthMm?: number,
  outerLengthMm?: number,
  layoutVersion?: PurlinClearLayoutVersion,
): PlanPurlinDividers {
  if (current?.mode === 'manual') {
    return { mode: 'manual', lines: [...(current.lines ?? [])] }
  }
  return {
    mode: 'manual',
    lines: resolvePurlinPositionsMm({
      rangeMinMm,
      rangeMaxMm,
      maxSpanMm,
      mode: 'auto',
      endBeamPlanWidthMm,
      outerLengthMm,
      layoutVersion,
    }),
  }
}
