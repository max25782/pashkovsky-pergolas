/**
 * Factory lamella sections (лист «פריסת למלות»).
 *
 * One function. Sheet, cut list, PDF and 3D all read these cells.
 *
 * 1. Field = inner contour (inner faces of the frame), from measured covering
 *    plus per-edge inset. The L/G cutout is grown by the notch-edge insets so
 *    the field stops at those inner faces — not at a centerline or outer face.
 * 2. Subtract every support as a real-width rectangle: vertical purlins (40)
 *    and the support line. Remaining connected rectangles are cells.
 *    One cell = one factory section. No extra partitions.
 * 3. Per cell, independently: clear_x / clear_y = face-to-face;
 *    W = clear_x − 15, H = clear_y − 30.
 * 4. Drawn rect is that W × H at the cell's plan position. Label uses the
 *    same numbers as the drawn size.
 *
 * Support line: catalog purlin-plain-5030 is 30 mm in-plan × 50 mm vertical.
 * The subtracted band is the 8000 notch *frame* the shelf sits on (beam plan
 * width, 50 mm here) — one band, not 30 + 50, so the left block has two
 * height cells, not three.
 *
 * Versioned: `lamellaSectionLayoutVersion === 1`. Unset ⇒ legacy continuous rows.
 */

import type { CutPiece, PergolaSpec, Point2D, ProfileDimensions } from './types'
import {
  beamPlanWidthForDrawing,
  contourSideWidthMm,
  DIVIDER_PLAN_CLEARANCE_WIDTH_MM,
  innerFaceClearMm,
  lamellaRunEndEdgeIndices,
} from './beamPlanWidth'
import { decomposeIntoRectangles, type Rectangle } from './rectangleDecomposition'
import { sanitizeContour } from './contourSanitize'
import { isCCW } from './miter'
import {
  formatPurlinClearLabelMm,
  measuredOuterAlongLamellas,
  resolveContourPurlinPositions,
  resolvePurlinEndInsetMm,
} from './lamellaSpans'
import { patternMaxLamellaSpanMm, resolveLamellaPattern, type LamellaPatternEntry } from './lamellaPattern'
import { resolveWingShelfSupport } from './planEditorDimensions'
import { computeFrame } from './frame'
import { pieceAxis } from './pieceAxis'
import { contourAxesMatchEnteredOuters } from './planEditorOuterAxis'
import { DEFAULT_PLAN_CONSTRUCTION_PARAMS } from './planDefaults'
import { isHorizontalPlane, placeOnRoof, roofPlane, type RoofPlane } from './roof'

export const LAMELLA_SECTION_CLEARANCE_W_MM = 15
export const LAMELLA_SECTION_CLEARANCE_H_MM = 30

/**
 * Section size from the same inner-face clear as the purlin and the shelf
 * (`innerFaceClearMm`). Width = gap between purlins − 15.
 * Height = shortest overlapping purlin − 30.
 */
export function factorySectionSizeMm(clearWMm: number, clearHMm: number): { widthMm: number; heightMm: number } {
  return {
    widthMm: clearWMm - LAMELLA_SECTION_CLEARANCE_W_MM,
    heightMm: clearHMm - LAMELLA_SECTION_CLEARANCE_H_MM,
  }
}
export const LAMELLA_SECTION_LAYOUT_VERSION = 1 as const
export const LAMELLA_SECTION_LABEL_TOLERANCE_MM = 0.5
export type LamellaSectionLayoutVersion = typeof LAMELLA_SECTION_LAYOUT_VERSION

export function isLamellaSectionLayoutV1(
  version: number | undefined,
): version is LamellaSectionLayoutVersion {
  return version === LAMELLA_SECTION_LAYOUT_VERSION
}

export type LamellaSectionFace = 'frame' | 'purlin' | 'support' | 'notch'

export interface LamellaSection {
  id: string
  /** Factory width = inner clear − 15 (lamella cut length). */
  widthMm: number
  /** Factory height = inner clear − 30 (row pack). */
  heightMm: number
  /** Inner-face clear along lamella length (before −15). */
  clearWMm: number
  /** Inner-face clear along row axis (before −30). */
  clearHMm: number
  lamellaCount: number
  pitchMm: number
  /** Plan rectangle of the factory section (W × H), not the raw clear. */
  minX: number
  maxX: number
  minY: number
  maxY: number
  faceX0: LamellaSectionFace
  faceX1: LamellaSectionFace
  faceY0: LamellaSectionFace
  faceY1: LamellaSectionFace
  /**
   * Set when `skewSectionVersion === 1` and one end is not within 1.5° of
   * 90° to the lamella. Absent on a rectangle, including every saved plan
   * that does not carry the version.
   */
  trapezoid?: LamellaTrapezoid
}

/**
 * Factory outline of a cell whose end beam is not square.
 * `corners` are [low-start, low-end, high-end, high-start] in plan mm.
 * Index 0 of `lamellaLengthsMm` is the row at the low end of the stack.
 */
export interface LamellaTrapezoid {
  corners: [Point2D, Point2D, Point2D, Point2D]
  /** Outline width at the low end (plan bottom when lamellas run along X). */
  widthAtLowMm: number
  /** Outline width at the high end (plan top when lamellas run along X). */
  widthAtHighMm: number
  /** Cut length of each row: narrowest clearance in that row, minus 15, floored. */
  lamellaLengthsMm: number[]
  /**
   * How far each row's upper edge sits below the section's top outline.
   * Same order as `lamellaLengthsMm` (low end first). The top row is inset
   * by the leftover of the pitch, so its cut is wider than the top outline.
   */
  upperFromTopMm?: number[]
}

export const DEFAULT_LAMELLA_LENGTH_STEP_MM = 1

/**
 * Floor to the millimetre. 0.005 mm keeps 1250.998 on 1251
 * and leaves 1250.99 on 1250. Exact integers stay put.
 */
export function floorShownMm(lengthMm: number): number {
  if (!Number.isFinite(lengthMm)) return 0
  return Math.floor(lengthMm + 0.005)
}

/** Floor a lamella cut. Step defaults to 1 mm. Exact integers stay put. */
export function floorLamellaLengthMm(lengthMm: number, stepMm: number = DEFAULT_LAMELLA_LENGTH_STEP_MM): number {
  const step = stepMm > 0 && Number.isFinite(stepMm) ? stepMm : DEFAULT_LAMELLA_LENGTH_STEP_MM
  if (!(lengthMm > 0)) return 0
  return Math.floor((lengthMm + 0.005) / step) * step
}

/** Rows whose cut floored to 0 mm are the triangle tip. They are not lamellas. */
export function countedLamellaRows(section: LamellaSection): number {
  const lengths = section.trapezoid?.lamellaLengthsMm
  if (!lengths) return section.lamellaCount
  return lengths.filter((length) => length > 0).length
}

/** A side more than this far from 90° to the lamella is a trapezoid end. Matches frame joints. */
const SKEW_END_TOL_DEG = 1.5

/**
 * Face-to-face opening beside a square-ended purlin.
 * The purlin sits in the divider gap, so it is next to the drawn cell,
 * not inside it. The opening extends past the drawn rect by half of
 * (clear − drawn) on each end — 15 mm when the height gap is 30.
 * Length of that opening is the cell clear, i.e. section height + 30.
 */
export function sectionOpeningForDividerSpan(
  sections: LamellaSection[],
  start: Point2D,
  end: Point2D,
): { start: Point2D; end: Point2D; clearMm: number } | null {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const vertical = Math.abs(dx) <= Math.abs(dy)
  const line = vertical ? (start[0] + end[0]) / 2 : (start[1] + end[1]) / 2
  const span0 = vertical ? Math.min(start[1], end[1]) : Math.min(start[0], end[0])
  const span1 = vertical ? Math.max(start[1], end[1]) : Math.max(start[0], end[0])
  let best: LamellaSection | null = null
  let bestOverlap = 0
  for (const section of sections) {
    const edgeDist = vertical
      ? Math.min(Math.abs(line - section.minX), Math.abs(line - section.maxX))
      : Math.min(Math.abs(line - section.minY), Math.abs(line - section.maxY))
    if (edgeDist > DIVIDER_PLAN_CLEARANCE_WIDTH_MM) continue
    const a0 = vertical ? Math.min(section.minY, section.maxY) : Math.min(section.minX, section.maxX)
    const a1 = vertical ? Math.max(section.minY, section.maxY) : Math.max(section.minX, section.maxX)
    const overlap = Math.min(span1, a1) - Math.max(span0, a0)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = section
    }
  }
  if (best == null || bestOverlap < 1) return null
  const clear = vertical ? best.clearHMm : best.clearWMm
  const drawn = vertical ? best.heightMm : best.widthMm
  const pad = (clear - drawn) / 2
  if (vertical) {
    const y0 = Math.min(best.minY, best.maxY) - pad
    const y1 = Math.max(best.minY, best.maxY) + pad
    const goingUp = end[1] >= start[1]
    return {
      start: [line, goingUp ? y0 : y1],
      end: [line, goingUp ? y1 : y0],
      clearMm: y1 - y0,
    }
  }
  const x0 = Math.min(best.minX, best.maxX) - pad
  const x1 = Math.max(best.minX, best.maxX) + pad
  const goingRight = end[0] >= start[0]
  return {
    start: [goingRight ? x0 : x1, line],
    end: [goingRight ? x1 : x0, line],
    clearMm: x1 - x0,
  }
}

export interface LamellaSectionReportRow {
  id: string
  clearXMm: number
  clearYMm: number
  widthMm: number
  heightMm: number
  faces: string
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface ColumnHeightChecksum {
  id: string
  midX: number
  measuredOuterMm: number
  sumMm: number
  closes: boolean
  parts: Array<{ label: string; mm: number }>
}

const MIN_CELL_MM = 2
const EPS = 0.51

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

function uniqueSorted(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > EPS) out.push(v)
  }
  return out
}

function countRowsInHeight(heightMm: number, pattern: LamellaPatternEntry[], gapMm: number): number {
  if (heightMm < pattern[0].visibleWidthMm) return 0
  let scanT = pattern[0].visibleWidthMm * 0.5
  let i = 0
  let n = 0
  while (scanT + pattern[i % pattern.length].visibleWidthMm * 0.5 <= heightMm + 1e-6) {
    n += 1
    const entry = pattern[i % pattern.length]
    const next = pattern[(i + 1) % pattern.length]
    scanT += entry.visibleWidthMm * 0.5 + gapMm + next.visibleWidthMm * 0.5
    i += 1
    if (n > 2000) break
  }
  return n
}

function representativePitchMm(pattern: LamellaPatternEntry[], gapMm: number): number {
  const a = pattern[0].visibleWidthMm
  const b = pattern[Math.min(1, pattern.length - 1)].visibleWidthMm
  return a * 0.5 + gapMm + b * 0.5
}

function validRect(r: Rectangle): boolean {
  return r.maxX - r.minX > MIN_CELL_MM && r.maxY - r.minY > MIN_CELL_MM
}

function intersectRects(a: Rectangle, b: Rectangle): Rectangle | null {
  const r: Rectangle = {
    minX: Math.max(a.minX, b.minX),
    maxX: Math.min(a.maxX, b.maxX),
    minY: Math.max(a.minY, b.minY),
    maxY: Math.min(a.maxY, b.maxY),
  }
  return validRect(r) ? r : null
}

/** Split `src` into the rectangles that remain after removing `cut`. */
function subtractRect(src: Rectangle, cut: Rectangle): Rectangle[] {
  const ix0 = Math.max(src.minX, cut.minX)
  const ix1 = Math.min(src.maxX, cut.maxX)
  const iy0 = Math.max(src.minY, cut.minY)
  const iy1 = Math.min(src.maxY, cut.maxY)
  if (ix1 - ix0 < MIN_CELL_MM || iy1 - iy0 < MIN_CELL_MM) return [src]
  const out: Rectangle[] = []
  if (src.minX < ix0 - EPS) out.push({ minX: src.minX, maxX: ix0, minY: src.minY, maxY: src.maxY })
  if (src.maxX > ix1 + EPS) out.push({ minX: ix1, maxX: src.maxX, minY: src.minY, maxY: src.maxY })
  if (src.minY < iy0 - EPS) out.push({ minX: ix0, maxX: ix1, minY: src.minY, maxY: iy0 })
  if (src.maxY > iy1 + EPS) out.push({ minX: ix0, maxX: ix1, minY: iy1, maxY: src.maxY })
  return out.filter(validRect)
}

function subtractAll(field: Rectangle[], obstacles: Rectangle[]): Rectangle[] {
  let cur = field
  for (const obs of obstacles) cur = cur.flatMap((r) => subtractRect(r, obs))
  return cur
}

function sameSpan(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.abs(a0 - b0) <= EPS && Math.abs(a1 - b1) <= EPS
}

function unionRect(a: Rectangle, b: Rectangle): Rectangle {
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

/** Join remaining rectangles that share a full edge — one connected opening = one cell. */
function mergeAdjacentRects(rects: Rectangle[]): Rectangle[] {
  const cur = [...rects]
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < cur.length; i++) {
      for (let j = i + 1; j < cur.length; j++) {
        const a = cur[i]
        const b = cur[j]
        const touchX = Math.abs(a.maxX - b.minX) <= EPS || Math.abs(b.maxX - a.minX) <= EPS
        const touchY = Math.abs(a.maxY - b.minY) <= EPS || Math.abs(b.maxY - a.minY) <= EPS
        if (touchX && sameSpan(a.minY, a.maxY, b.minY, b.maxY)) {
          cur.splice(j, 1)
          cur[i] = unionRect(a, b)
          merged = true
          break outer
        }
        if (touchY && sameSpan(a.minX, a.maxX, b.minX, b.maxX)) {
          cur.splice(j, 1)
          cur[i] = unionRect(a, b)
          merged = true
          break outer
        }
      }
    }
  }
  return cur
}

/**
 * In-plan thickness of the wing-shelf *profile* (catalog).
 * purlin-plain-5030 is 30 × 50: widthMm=30 is the plan footprint; heightMm=50
 * is vertical. This is NOT the subtracted support band — see
 * `supportLineObstacleWidthMm`.
 */
export function wingShelfPlanWidthMm(
  profiles: Map<string, ProfileDimensions>,
  profileId: string | undefined,
): number {
  if (!profileId || !profiles.has(profileId)) return 0
  const profile = profiles.get(profileId)
  return profile && profile.widthMm > 0 ? profile.widthMm : 0
}

/**
 * Width subtracted from the field for the support line.
 * The shelf sits on the notch frame (8000), so one beam-width band (50 on
 * F20050) — not catalog 30 and not 30+50, which would invent a third height cell.
 */
export function supportLineObstacleWidthMm(
  profiles: Map<string, ProfileDimensions>,
  beamProfileId: string,
): number {
  const beamW = beamPlanWidthForDrawing(profiles, beamProfileId).planWidthMm
  return beamW > 0 ? beamW : 50
}

/** Plan width of the frame beam the shelf sits on. Same as the beam profile when every side matches. */
function supportBandWidthMm(
  support: { start: Point2D; end: Point2D } | null,
  beams: CutPiece[],
  profiles: Map<string, ProfileDimensions>,
  beamProfileId: string,
  useSideWidth: boolean,
): number {
  const fallback = supportLineObstacleWidthMm(profiles, beamProfileId)
  if (!useSideWidth || support == null) return fallback
  const shelfDir: Point2D = [
    support.end[0] - support.start[0],
    support.end[1] - support.start[1],
  ]
  const shelfLen = Math.hypot(shelfDir[0], shelfDir[1])
  if (shelfLen < 1) return fallback
  const u: Point2D = [shelfDir[0] / shelfLen, shelfDir[1] / shelfLen]
  const mid: Point2D = [
    (support.start[0] + support.end[0]) / 2,
    (support.start[1] + support.end[1]) / 2,
  ]
  let bestDist = Infinity
  let best = fallback
  for (const beam of beams) {
    if (beam.role !== 'beam') continue
    const axis = pieceAxis(beam)
    const ex = axis.end[0] - axis.start[0]
    const ey = axis.end[1] - axis.start[1]
    const el = Math.hypot(ex, ey)
    if (el < 1) continue
    const bu: Point2D = [ex / el, ey / el]
    if (Math.abs(bu[0] * u[0] + bu[1] * u[1]) < 0.99) continue
    const rx = mid[0] - axis.start[0]
    const ry = mid[1] - axis.start[1]
    const dist = Math.abs(rx * bu[1] - ry * bu[0])
    if (dist < bestDist) {
      bestDist = dist
      best = beamPlanWidthForDrawing(profiles, beam.profileId).planWidthMm
    }
  }
  return best > 0 ? best : fallback
}

/** True when the shelf midpoint lies on a frame-beam segment, not only on its infinite line. */
function supportRestsOnBeamSegment(
  support: { start: Point2D; end: Point2D },
  beams: CutPiece[],
): boolean {
  const mid: Point2D = [
    (support.start[0] + support.end[0]) / 2,
    (support.start[1] + support.end[1]) / 2,
  ]
  const sdx = support.end[0] - support.start[0]
  const sdy = support.end[1] - support.start[1]
  const sl = Math.hypot(sdx, sdy)
  if (sl < 1) return false
  const su: Point2D = [sdx / sl, sdy / sl]
  for (const beam of beams) {
    if (beam.role !== 'beam') continue
    const axis = pieceAxis(beam)
    const ex = axis.end[0] - axis.start[0]
    const ey = axis.end[1] - axis.start[1]
    const el = Math.hypot(ex, ey)
    if (el < 1) continue
    const bu: Point2D = [ex / el, ey / el]
    if (Math.abs(bu[0] * su[0] + bu[1] * su[1]) < 0.99) continue
    const rx = mid[0] - axis.start[0]
    const ry = mid[1] - axis.start[1]
    const dist = Math.abs(rx * bu[1] - ry * bu[0])
    if (dist > 1) continue
    const along = rx * bu[0] + ry * bu[1]
    if (along < -1 || along > el + 1) continue
    return true
  }
  return false
}

function formatSectionHeightLabel(heightMm: number): string {
  const height = Math.round(heightMm * 10) / 10
  return Math.abs(height - Math.round(height)) < 0.05
    ? String(Math.round(height))
    : height.toFixed(1)
}

export function formatLamellaSectionSizeMm(widthMm: number, heightMm: number): string {
  return `${formatPurlinClearLabelMm(widthMm)}×${formatSectionHeightLabel(heightMm)}`
}

/** Section table: top width / bottom width × height. */
export function formatTrapezoidSectionSizeMm(widthAtHighMm: number, widthAtLowMm: number, heightMm: number): string {
  return `${formatPurlinClearLabelMm(widthAtHighMm)} / ${formatPurlinClearLabelMm(widthAtLowMm)}×${formatSectionHeightLabel(heightMm)}`
}

export function sectionDrawnSizeMm(section: LamellaSection): { widthMm: number; heightMm: number } {
  return { widthMm: section.maxX - section.minX, heightMm: section.maxY - section.minY }
}

/** Label numbers must equal the drawn outline (tolerance 0.5 mm). */
export function sectionLabelMatchesDrawn(
  section: LamellaSection,
  toleranceMm: number = LAMELLA_SECTION_LABEL_TOLERANCE_MM,
): boolean {
  const drawn = sectionDrawnSizeMm(section)
  const trap = section.trapezoid
  if (trap) {
    const [lowL, lowR, highR, highL] = trap.corners
    const lowW = Math.hypot(lowR[0] - lowL[0], lowR[1] - lowL[1])
    const highW = Math.hypot(highR[0] - highL[0], highR[1] - highL[1])
    return (
      Math.abs(lowW - trap.widthAtLowMm) <= toleranceMm &&
      Math.abs(highW - trap.widthAtHighMm) <= toleranceMm &&
      Math.abs(drawn.heightMm - section.heightMm) <= toleranceMm
    )
  }
  return (
    Math.abs(drawn.widthMm - section.widthMm) <= toleranceMm &&
    Math.abs(drawn.heightMm - section.heightMm) <= toleranceMm
  )
}

export function describeLamellaSectionFaces(section: LamellaSection): string {
  return `x:${section.faceX0}→${section.faceX1} y:${section.faceY0}→${section.faceY1}`
}

/** Two factory cells are the same type when both W and H match within 0.5 mm. */
export const LAMELLA_SECTION_TYPE_TOLERANCE_MM = 0.5

export interface LamellaSectionTypeGroup {
  typeId: string
  count: number
  widthMm: number
  heightMm: number
  sizeLabel: string
  /** Lamella rows in one section of this type. */
  lamellasPerSection: number
  /** Cut length of one lamella: the section width (clear − 15). A trapezoid uses the top row. */
  lamellaLengthMm: number
  /** «верх / низ» when the rows are not one length. */
  lamellaLengthLabel?: string
  /** One cut per row, low end first, when the section is a trapezoid. */
  lamellaLengthsMm?: number[]
  /** Outline widths when the section is a trapezoid. */
  widthAtHighMm?: number
  widthAtLowMm?: number
  sectionIds: string[]
}

export interface LamellaSectionSchedule {
  types: LamellaSectionTypeGroup[]
  totalSections: number
  totalLamellas: number
}

export function lamellaSectionTypeLetter(index: number): string {
  let n = index + 1
  let label = ''
  while (n > 0) {
    n -= 1
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26)
  }
  return label
}

function sameSectionSize(a: LamellaSection, b: LamellaSection): boolean {
  if (Math.abs(a.heightMm - b.heightMm) > LAMELLA_SECTION_TYPE_TOLERANCE_MM) return false
  const at = a.trapezoid
  const bt = b.trapezoid
  if (at || bt) {
    if (!at || !bt) return false
    return (
      Math.abs(at.widthAtHighMm - bt.widthAtHighMm) <= LAMELLA_SECTION_TYPE_TOLERANCE_MM &&
      Math.abs(at.widthAtLowMm - bt.widthAtLowMm) <= LAMELLA_SECTION_TYPE_TOLERANCE_MM
    )
  }
  return Math.abs(a.widthMm - b.widthMm) <= LAMELLA_SECTION_TYPE_TOLERANCE_MM
}

/**
 * Production schedule from the same cells `buildLamellaSections` already
 * returned. No second geometry pass. Types are A, B, C… by quantity, descending.
 */
export function groupLamellaSectionTypes(sections: LamellaSection[]): LamellaSectionSchedule {
  const remaining = [...sections]
  const buckets: LamellaSection[][] = []
  while (remaining.length > 0) {
    const seed = remaining[0]
    const members: LamellaSection[] = []
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (!sameSectionSize(remaining[i], seed)) continue
      members.push(remaining[i])
      remaining.splice(i, 1)
    }
    buckets.push(members)
  }
  buckets.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length
    const ah = a[0].heightMm
    const bh = b[0].heightMm
    if (Math.abs(bh - ah) > LAMELLA_SECTION_TYPE_TOLERANCE_MM) return bh - ah
    return b[0].widthMm - a[0].widthMm
  })
  const types = buckets.map((members, index): LamellaSectionTypeGroup => {
    const sample = members[0]
    const trap = sample.trapezoid
    const cuts = trap ? trap.lamellaLengthsMm.filter((length) => length > 0) : null
    const topCut = cuts ? cuts[cuts.length - 1] : sample.widthMm
    const bottomCut = cuts ? cuts[0] : sample.widthMm
    const varied = cuts != null && cuts.length > 1 && Math.abs(topCut - bottomCut) > LAMELLA_SECTION_TYPE_TOLERANCE_MM
    return {
      typeId: lamellaSectionTypeLetter(index),
      count: members.length,
      widthMm: sample.widthMm,
      heightMm: sample.heightMm,
      sizeLabel: trap
        ? formatTrapezoidSectionSizeMm(trap.widthAtHighMm, trap.widthAtLowMm, sample.heightMm)
        : formatLamellaSectionSizeMm(sample.widthMm, sample.heightMm),
      lamellasPerSection: countedLamellaRows(sample),
      lamellaLengthMm: topCut ?? sample.widthMm,
      ...(varied && cuts
        ? {
            lamellaLengthLabel: `${topCut} / ${bottomCut}`,
            lamellaLengthsMm: cuts,
          }
        : {}),
      ...(trap
        ? { widthAtHighMm: trap.widthAtHighMm, widthAtLowMm: trap.widthAtLowMm }
        : {}),
      sectionIds: members.map((s) => s.id),
    }
  })
  return {
    types,
    totalSections: sections.length,
    totalLamellas: sections.reduce((sum, section) => sum + countedLamellaRows(section), 0),
  }
}

export function lamellaSectionTypeById(schedule: LamellaSectionSchedule): Map<string, string> {
  const map = new Map<string, string>()
  for (const type of schedule.types) {
    for (const id of type.sectionIds) map.set(id, type.typeId)
  }
  return map
}

export function reportLamellaSections(sections: LamellaSection[]): LamellaSectionReportRow[] {
  return [...sections]
    .sort((a, b) => b.minY - a.minY || a.minX - b.minX)
    .map((s) => ({
      id: s.id,
      clearXMm: s.clearWMm,
      clearYMm: s.clearHMm,
      widthMm: s.widthMm,
      heightMm: s.heightMm,
      faces: describeLamellaSectionFaces(s),
      minX: s.minX,
      maxX: s.maxX,
      minY: s.minY,
      maxY: s.maxY,
    }))
}

function edgeInsetMm(
  a: Point2D,
  b: Point2D,
  measured: number | null | undefined,
  beamW: number,
  layoutVersion: 1 | undefined,
): number {
  const axis = Math.hypot(b[0] - a[0], b[1] - a[1])
  const hasOuter = typeof measured === 'number' && measured > 0 && Math.abs(measured - axis) > 1
  // Centerline contour, v1: the cutout grows to the beam's inner face (half
  // the beam), the same face the purlin stops on. Passing outer=axis into
  // purlinEndInsetMm returns the full width and shortens the bay by another 20.
  if (layoutVersion === 1 && !hasOuter) return beamW / 2
  return resolvePurlinEndInsetMm({
    axisLengthMm: axis,
    outerLengthMm: typeof measured === 'number' && measured > 0 ? measured : axis,
    endWidthMm: beamW,
    layoutVersion,
    outerIsExplicit: typeof measured === 'number' && measured > 0,
  })
}

function insetAtVertical(
  pts: Point2D[],
  measured: Array<number | null | undefined> | undefined,
  x: number,
  beamW: number,
  layoutVersion: 1 | undefined,
  widthAt: (edgeIndex: number) => number = () => beamW,
): number {
  let best = beamW / 2
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    if (Math.abs(a[0] - b[0]) > 2) continue
    if (Math.abs((a[0] + b[0]) / 2 - x) > 2) continue
    best = Math.max(best, edgeInsetMm(a, b, measured?.[i], widthAt(i), layoutVersion))
  }
  return best
}

function insetAtHorizontal(
  pts: Point2D[],
  measured: Array<number | null | undefined> | undefined,
  y: number,
  beamW: number,
  layoutVersion: 1 | undefined,
  widthAt: (edgeIndex: number) => number = () => beamW,
): number {
  let best = beamW / 2
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    if (Math.abs(a[1] - b[1]) > 2) continue
    if (Math.abs((a[1] + b[1]) / 2 - y) > 2) continue
    best = Math.max(best, edgeInsetMm(a, b, measured?.[i], widthAt(i), layoutVersion))
  }
  return best
}

function sectionInnerSpanMm(
  axisMm: number,
  outerMm: number,
  startWidthMm: number,
  endWidthMm: number,
  explicitOuter: boolean,
  layoutVersion: 1 | undefined,
): number {
  const distinctOuter = explicitOuter && Math.abs(outerMm - axisMm) > 1
  if (layoutVersion === 1 && !distinctOuter && !explicitOuter) {
    return innerFaceClearMm({ axisLengthMm: axisMm, startWidthMm, endWidthMm })
  }
  return innerFaceClearMm({
    axisLengthMm: axisMm,
    outerLengthMm: outerMm,
    startWidthMm,
    endWidthMm,
  })
}

function insetOuterMm(
  axisMm: number,
  outerMm: number,
  startWidthMm: number,
  endWidthMm: number,
  explicitOuter: boolean,
  layoutVersion: 1 | undefined,
): number {
  if (explicitOuter && Math.abs(outerMm - axisMm) > 1) return outerMm
  if (layoutVersion === 1 && !explicitOuter) return axisMm + startWidthMm / 2 + endWidthMm / 2
  return axisMm
}

function measuredInnerAabb(
  pts: Point2D[],
  spec: PergolaSpec,
  beamW: number,
  widthAt: (edgeIndex: number) => number = () => beamW,
): Rectangle {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const layoutVersion = spec.purlinClearLayoutVersion === 1 ? 1 : undefined
  const axisX = maxX - minX
  const axisY = maxY - minY
  const outerX =
    measuredOuterAlongLamellas(pts, spec.lamellaDirectionDeg, spec.measuredOuterLengthMmByEdgeIndex)
    ?? axisX
  const outerY =
    measuredOuterAlongLamellas(pts, spec.lamellaDirectionDeg + 90, spec.measuredOuterLengthMmByEdgeIndex)
    ?? axisY
  const runEnds = lamellaRunEndEdgeIndices(pts, spec.lamellaDirectionDeg)
  const alongX = Math.abs(Math.cos((spec.lamellaDirectionDeg * Math.PI) / 180)) >=
    Math.abs(Math.sin((spec.lamellaDirectionDeg * Math.PI) / 180))
  const endLeftW = widthAt(runEnds.leftEdgeIndex)
  const endRightW = widthAt(runEnds.rightEdgeIndex)
  // A side a few degrees off axis is still the run end. widthOfEdgeNear
  // only sees edges within 2 mm of vertical/horizontal and would fall
  // back to the free-beam width, pulling that cell in by beam − wall.
  const leftW = alongX ? endLeftW : widthOfEdgeNear(pts, 'x', minX, widthAt, beamW)
  const rightW = alongX ? endRightW : widthOfEdgeNear(pts, 'x', maxX, widthAt, beamW)
  const bottomW = alongX ? widthOfEdgeNear(pts, 'y', minY, widthAt, beamW) : endLeftW
  const topW = alongX ? widthOfEdgeNear(pts, 'y', maxY, widthAt, beamW) : endRightW
  const explicitOuter = spec.measuredOuterLengthMmByEdgeIndex != null
  // A saved centerline built for a narrower beam is not rewritten. The cell
  // then follows the drawn beam faces (axis minus the current halves). A
  // contour that already matches, or one with no typed outers, keeps the
  // outer-based span.
  const contourMismatch = contourAxesMatchEnteredOuters({
    contour: pts,
    measuredOuterLengthMmByEdgeIndex: spec.measuredOuterLengthMmByEdgeIndex,
    defaultBeamPlanWidthMm: beamW,
    planWidthForEdge: widthAt,
  }) === 'mismatch'
  const drawnSpan = (axisMm: number, startWidthMm: number, endWidthMm: number) =>
    innerFaceClearMm({ axisLengthMm: axisMm, startWidthMm, endWidthMm })
  const spanX = contourMismatch && !alongX
    ? drawnSpan(axisX, leftW, rightW)
    : sectionInnerSpanMm(axisX, outerX, leftW, rightW, explicitOuter, layoutVersion)
  const spanY = contourMismatch && alongX
    ? drawnSpan(axisY, bottomW, topW)
    : sectionInnerSpanMm(axisY, outerY, bottomW, topW, explicitOuter, layoutVersion)
  const insetX = resolvePurlinEndInsetMm({
    axisLengthMm: axisX,
    outerLengthMm: insetOuterMm(axisX, outerX, leftW, rightW, explicitOuter, layoutVersion),
    endWidthMm: leftW,
    layoutVersion,
    outerIsExplicit: explicitOuter && outerX !== axisX,
  })
  const insetY = resolvePurlinEndInsetMm({
    axisLengthMm: axisY,
    outerLengthMm: insetOuterMm(axisY, outerY, bottomW, topW, explicitOuter, layoutVersion),
    endWidthMm: bottomW,
    layoutVersion,
    outerIsExplicit: explicitOuter && outerY !== axisY,
  })
  return {
    minX: minX + insetX,
    maxX: minX + insetX + spanX,
    minY: minY + insetY,
    maxY: minY + insetY + spanY,
  }
}

function widthOfEdgeNear(
  pts: Point2D[],
  axis: 'x' | 'y',
  value: number,
  widthAt: (edgeIndex: number) => number,
  fallback: number,
): number {
  let best = fallback
  let bestDist = 2
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const vertical = Math.abs(a[0] - b[0]) <= 2
    const horizontal = Math.abs(a[1] - b[1]) <= 2
    if (axis === 'x' && !vertical) continue
    if (axis === 'y' && !horizontal) continue
    const mid = axis === 'x' ? (a[0] + b[0]) / 2 : (a[1] + b[1]) / 2
    const dist = Math.abs(mid - value)
    if (dist < bestDist) {
      bestDist = dist
      best = widthAt(i)
    }
  }
  return best
}

function growCutoutTowardSolid(
  hole: Rectangle,
  aabb: Rectangle,
  pts: Point2D[],
  measured: Array<number | null | undefined> | undefined,
  beamW: number,
  layoutVersion: 1 | undefined,
  widthAt: (edgeIndex: number) => number = () => beamW,
): Rectangle {
  const grown = { ...hole }
  if (Math.abs(hole.minX - aabb.minX) > 2) {
    grown.minX -= insetAtVertical(pts, measured, hole.minX, beamW, layoutVersion, widthAt)
  }
  if (Math.abs(hole.maxX - aabb.maxX) > 2) {
    grown.maxX += insetAtVertical(pts, measured, hole.maxX, beamW, layoutVersion, widthAt)
  }
  if (Math.abs(hole.minY - aabb.minY) > 2) {
    grown.minY -= insetAtHorizontal(pts, measured, hole.minY, beamW, layoutVersion, widthAt)
  }
  if (Math.abs(hole.maxY - aabb.maxY) > 2) {
    grown.maxY += insetAtHorizontal(pts, measured, hole.maxY, beamW, layoutVersion, widthAt)
  }
  return grown
}

/**
 * A wall notch narrower than the free beam keeps the lower inner face where
 * the free beam's lower face was. The saved thickness (50 − 40 = 10) goes
 * to the upper bay, so 3500 − 50 − 40 − 30 = 3380 instead of 3370.
 * Only when the cutout was grown by the free-beam half (the floor in
 * insetAtHorizontal). A centerline that already used this wall's inset
 * is left alone.
 */
function pullNarrowWallNotchIntoUpperBay(
  cut: Rectangle,
  pts: Point2D[],
  beamW: number,
  widthAt: (edgeIndex: number) => number,
): Rectangle {
  const next = { ...cut }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    if (Math.abs(a[1] - b[1]) > 2) continue
    const y = (a[1] + b[1]) / 2
    if (Math.abs(cut.maxY - y) > beamW) continue
    const wallW = widthAt(i)
    if (!(wallW > 0) || wallW + 0.5 >= beamW) continue
    const gap = cut.maxY - y
    if (Math.abs(gap - beamW / 2) > 2) continue
    // 50 vs 40: give the saved 10 mm to the upper bay (3500 − 50 − 40 − 30 = 3380).
    // Wider free beam (double-T 70 vs wall 40): sit on the wall's own top face
    // so the band of wallW below it is the notch-side face, not the free-beam half.
    next.maxY = beamW - wallW <= 15
      ? y + beamW / 2 - (beamW - wallW)
      : y + wallW / 2
  }
  return next
}

function buildInnerFieldRects(
  pts: Point2D[],
  spec: PergolaSpec,
  beamW: number,
  widthAt: (edgeIndex: number) => number = () => beamW,
): { field: Rectangle[]; aabb: Rectangle; cutouts: Rectangle[] } {
  const aabb = measuredInnerAabb(pts, spec, beamW, widthAt)
  const raw = decomposeIntoRectangles(pts) ?? []
  const layoutVersion = spec.purlinClearLayoutVersion === 1 ? 1 : undefined
  const solid = raw
    .map((r) => intersectRects(r, aabb))
    .filter((r): r is Rectangle => r != null)
  let holes: Rectangle[] = [aabb]
  for (const s of solid) holes = holes.flatMap((h) => subtractRect(h, s))
  const cutouts = holes.map((h) =>
    growCutoutTowardSolid(h, aabb, pts, spec.measuredOuterLengthMmByEdgeIndex, beamW, layoutVersion, widthAt),
  )
  return { field: subtractAll([aabb], cutouts), aabb, cutouts }
}

type FaceBand = {
  a0: number
  a1: number
  t0: number
  t1: number
  kind: LamellaSectionFace
}

function classifyFace(
  cut: number,
  span0: number,
  span1: number,
  bands: FaceBand[],
  fallback: LamellaSectionFace,
): LamellaSectionFace {
  let found: LamellaSectionFace | undefined
  for (const b of bands) {
    if (b.t1 < span0 + EPS || b.t0 > span1 - EPS) continue
    if (Math.abs(cut - b.a0) <= EPS || Math.abs(cut - b.a1) <= EPS) {
      if (b.kind === 'purlin' || b.kind === 'support') return b.kind
      if (b.kind === 'notch') found = 'notch'
      else if (found == null) found = b.kind
    }
  }
  return found ?? fallback
}

interface OffsetEdge {
  a: Point2D
  b: Point2D
}

function edgeInwardUnit(a: Point2D, b: Point2D): Point2D | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  if (len < 1) return null
  return [-dy / len, dx / len]
}

/** Beam inner faces. The contour is CCW, so left-of-travel is inside. */
function innerOffsetEdges(
  pts: Point2D[],
  widthAt: (edgeIndex: number) => number,
): OffsetEdge[] {
  const edges: OffsetEdge[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const inward = edgeInwardUnit(a, b)
    if (!inward) continue
    const half = widthAt(i) / 2
    edges.push({
      a: [a[0] + inward[0] * half, a[1] + inward[1] * half],
      b: [b[0] + inward[0] * half, b[1] + inward[1] * half],
    })
  }
  return edges
}

function innerXSpan(edges: OffsetEdge[], y: number): [number, number] | null {
  const hits: number[] = []
  for (const edge of edges) {
    const y0 = edge.a[1]
    const y1 = edge.b[1]
    if (Math.abs(y1 - y0) < 1e-6) continue
    const t = (y - y0) / (y1 - y0)
    if (t < -1e-4 || t > 1 + 1e-4) continue
    hits.push(edge.a[0] + t * (edge.b[0] - edge.a[0]))
  }
  if (hits.length < 2) return null
  hits.sort((a, b) => a - b)
  const left = hits[0]
  const right = hits[hits.length - 1]
  return right - left > MIN_CELL_MM ? [left, right] : null
}

function yOnOffsetEdge(edge: OffsetEdge, x: number): number | null {
  const x0 = edge.a[0]
  const x1 = edge.b[0]
  if (Math.abs(x1 - x0) < 1e-6) return null
  const t = (x - x0) / (x1 - x0)
  if (t < -1e-4 || t > 1 + 1e-4) return null
  return edge.a[1] + t * (edge.b[1] - edge.a[1])
}

/**
 * Section cells when the contour is not a rectangle union (a real diagonal).
 * Bays are the inner faces split by the shelf and by purlins that cross the
 * bay. A side that is not vertical becomes the trapezoid end.
 */
function openSkewBaySections(input: {
  pts: Point2D[]
  spec: PergolaSpec
  pattern: LamellaPatternEntry[]
  widthAt: (edgeIndex: number) => number
  positions: Array<{ positionMm: number }>
  support: { start: Point2D; end: Point2D; lengthMm: number } | null
  supportW: number
}): LamellaSection[] {
  const θ = (input.spec.lamellaDirectionDeg * Math.PI) / 180
  const runX = Math.cos(θ)
  const runY = Math.sin(θ)
  if (Math.abs(runX) < Math.abs(runY)) return []
  const edges = innerOffsetEdges(input.pts, input.widthAt)
  const horizontalYs: number[] = []
  for (let i = 0; i < input.pts.length; i++) {
    const a = input.pts[i]
    const b = input.pts[(i + 1) % input.pts.length]
    if (Math.abs(a[1] - b[1]) > 2) continue
    const inward = edgeInwardUnit(a, b)
    if (!inward) continue
    horizontalYs.push((a[1] + b[1]) / 2 + inward[1] * (input.widthAt(i) / 2))
  }
  if (horizontalYs.length < 2) return []
  const yBottom = Math.min(...horizontalYs)
  const yTop = Math.max(...horizontalYs)
  const purlinHalf = DIVIDER_PLAN_CLEARANCE_WIDTH_MM / 2
  const sideInset = LAMELLA_SECTION_CLEARANCE_W_MM / 2
  const stackInset = LAMELLA_SECTION_CLEARANCE_H_MM / 2
  let bands: Array<{ y0: number; y1: number }> = [{ y0: yBottom, y1: yTop }]
  const shelf = input.support != null && input.support.lengthMm > 1 && input.supportW > 1
    && Math.abs(input.support.start[1] - input.support.end[1]) <= 2
    ? {
        y0: (input.support.start[1] + input.support.end[1]) / 2 - input.supportW / 2,
        y1: (input.support.start[1] + input.support.end[1]) / 2 + input.supportW / 2,
      }
    : null
  if (shelf) {
    bands = bands.flatMap((band) => {
      const out: Array<{ y0: number; y1: number }> = []
      if (shelf.y0 - band.y0 > MIN_CELL_MM) out.push({ y0: band.y0, y1: Math.min(band.y1, shelf.y0) })
      if (band.y1 - shelf.y1 > MIN_CELL_MM) out.push({ y0: Math.max(band.y0, shelf.y1), y1: band.y1 })
      return out
    })
  }
  const cuts: number[] = []
  for (const pos of input.positions) {
    for (const edge of edges) {
      if (Math.abs(edge.a[1] - edge.b[1]) < 2 && Math.abs(edge.a[0] - edge.b[0]) > 2) continue
      const y = yOnOffsetEdge(edge, pos.positionMm)
      if (y == null || y <= yBottom + 1 || y >= yTop - 1) continue
      cuts.push(y)
    }
  }
  for (const y of cuts) {
    bands = bands.flatMap((band) => {
      if (y <= band.y0 + MIN_CELL_MM || y >= band.y1 - MIN_CELL_MM) return [band]
      return [{ y0: band.y0, y1: y }, { y0: y, y1: band.y1 }]
    })
  }
  const step = input.spec.lamellaLengthStepMm != null && input.spec.lamellaLengthStepMm > 0
    ? input.spec.lamellaLengthStepMm
    : DEFAULT_LAMELLA_LENGTH_STEP_MM
  const pitchMm = representativePitchMm(input.pattern, input.spec.lamellaGapMm)
  const sections: LamellaSection[] = []

  for (const band of bands) {
    if (band.y1 - band.y0 <= LAMELLA_SECTION_CLEARANCE_H_MM + MIN_CELL_MM) continue
    const y0 = band.y0 + 0.25
    const y1 = band.y1 - 0.25
    const span0 = innerXSpan(edges, y0)
    const span1 = innerXSpan(edges, y1)
    const spanMid = innerXSpan(edges, (y0 + y1) / 2)
    if (!span0 || !span1 || !spanMid) continue
    const bodyInside = (span: [number, number], x: number) =>
      x > span[0] + purlinHalf + 0.5 && x < span[1] - purlinHalf - 0.5
    const onOrInside = (span: [number, number], x: number) =>
      x >= span[0] - 1 && x <= span[1] + 1
    const splitters = input.positions
      .map((pos) => pos.positionMm)
      .filter((x) => bodyInside(spanMid, x) && onOrInside(span0, x) && onOrInside(span1, x))
      .sort((a, b) => a - b)
    const bounds: Array<number | null> = [null, ...splitters, null]
    for (let i = 0; i < bounds.length - 1; i++) {
      const leftBound = bounds[i]
      const rightBound = bounds[i + 1]
      const leftAt = (span: [number, number]) => leftBound == null ? span[0] : leftBound + purlinHalf
      const rightAt = (span: [number, number]) => rightBound == null ? span[1] : rightBound - purlinHalf
      const faceLeft0 = leftAt(span0)
      const faceRight0 = rightAt(span0)
      const faceLeft1 = leftAt(span1)
      const faceRight1 = rightAt(span1)
      if (faceRight0 - faceLeft0 <= MIN_CELL_MM && faceRight1 - faceLeft1 <= MIN_CELL_MM) continue
      const drawnY0 = band.y0 + stackInset
      const drawnY1 = band.y1 - stackInset
      const spanDrawn0 = innerXSpan(edges, drawnY0) ?? span0
      const spanDrawn1 = innerXSpan(edges, drawnY1) ?? span1
      const outline = (span: [number, number]) => {
        const left = leftAt(span) + sideInset
        const right = rightAt(span) - sideInset
        return { left, right, width: right - left }
      }
      const finite = (edge: { left: number; right: number; width: number }) => {
        if (edge.right >= edge.left) return edge
        const mid = (edge.left + edge.right) / 2
        return { left: mid, right: mid, width: 0 }
      }
      const low = finite(outline(spanDrawn0))
      const high = finite(outline(spanDrawn1))
      if (low.width <= MIN_CELL_MM && high.width <= MIN_CELL_MM) continue
      const varies = Math.abs(low.width - high.width) > 1.5
        || Math.abs(faceLeft0 - faceLeft1) > 1.5
        || Math.abs(faceRight0 - faceRight1) > 1.5
      const heightMm = drawnY1 - drawnY0
      const widthMm = varies ? Math.max(low.width, high.width) : low.width
      const clearW = Math.max(faceRight0 - faceLeft0, faceRight1 - faceLeft1)
      const clearH = band.y1 - band.y0
      const lamellaCount = countRowsInHeight(heightMm, input.pattern, input.spec.lamellaGapMm)
      if (lamellaCount <= 0 || heightMm < MIN_CELL_MM) continue
      const onShelf = (y: number) => shelf != null && (Math.abs(y - shelf.y0) < 1 || Math.abs(y - shelf.y1) < 1)
      const faceX0: LamellaSectionFace = leftBound == null ? 'frame' : 'purlin'
      const faceX1: LamellaSectionFace = rightBound == null ? (varies ? 'notch' : 'frame') : 'purlin'
      const section: LamellaSection = {
        id: `sec-${sections.length}`,
        widthMm: varies ? high.width : widthMm,
        heightMm,
        clearWMm: clearW,
        clearHMm: clearH,
        lamellaCount,
        pitchMm,
        minX: Math.min(low.left, high.left),
        maxX: Math.max(low.right, high.right),
        minY: drawnY0,
        maxY: drawnY1,
        faceX0,
        faceX1,
        faceY0: onShelf(band.y0) ? 'support' : 'frame',
        faceY1: onShelf(band.y1) ? 'support' : 'frame',
      }
      if (!varies) {
        sections.push(section)
        continue
      }
      const left = (span: [number, number]) => leftAt(span) + sideInset
      const right = (span: [number, number]) => rightAt(span) - sideInset
      const corners: LamellaTrapezoid['corners'] = [
        [low.left, drawnY0],
        [low.right, drawnY0],
        [high.right, drawnY1],
        [high.left, drawnY1],
      ]
      const lamellaLengthsMm: number[] = []
      const upperFromTopMm: number[] = []
      let scan = input.pattern[0].visibleWidthMm * 0.5
      let index = 0
      for (let row = 0; row < lamellaCount; row++) {
        const entry = input.pattern[index % input.pattern.length]
        const next = input.pattern[(index + 1) % input.pattern.length]
        const half = entry.visibleWidthMm * 0.5
        const band0 = drawnY0 + scan - half
        const band1 = drawnY0 + scan + half
        const spanA = innerXSpan(edges, band0) ?? spanDrawn0
        const spanB = innerXSpan(edges, band1) ?? spanDrawn1
        const w0 = Math.max(0, right(spanA) - left(spanA))
        const w1 = Math.max(0, right(spanB) - left(spanB))
        lamellaLengthsMm.push(floorLamellaLengthMm(Math.min(w0, w1), step))
        upperFromTopMm.push(drawnY1 - band1)
        scan += half + input.spec.lamellaGapMm + next.visibleWidthMm * 0.5
        index += 1
      }
      sections.push({
        ...section,
        trapezoid: {
          corners,
          widthAtLowMm: low.width,
          widthAtHighMm: high.width,
          lamellaLengthsMm,
          upperFromTopMm,
        },
      })
    }
  }
  sections.sort((a, b) => b.minY - a.minY || a.minX - b.minX)
  return sections.map((section, index) => ({ ...section, id: `sec-${index}` }))
}

export function buildLamellaSections(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): LamellaSection[] {
  const clean = sanitizeContour(spec.contour)
  if (clean.length < 3) return []
  const pts: Point2D[] = isCCW(clean) ? clean : [...clean].reverse()

  const beamW = beamPlanWidthForDrawing(profiles, spec.beamProfileId).planWidthMm
  const purlinW = DIVIDER_PLAN_CLEARANCE_WIDTH_MM
  const purlinHalf = purlinW / 2
  const sideWidthInput = {
    wallEdgeIndices: spec.wallEdgeIndices,
    beamProfileId: spec.beamProfileId,
    wallProfileId: spec.wallProfileId,
    wallBeamWidthVersion: spec.wallBeamWidthVersion,
  }
  const widthAt = (edgeIndex: number) =>
    spec.wallBeamWidthVersion === 1
      ? contourSideWidthMm(profiles, edgeIndex, sideWidthInput)
      : beamW

  let { field, aabb, cutouts } = buildInnerFieldRects(pts, spec, beamW, widthAt)
  if (field.length === 0 && spec.skewSectionVersion !== 1) return []

  const θ = (spec.lamellaDirectionDeg * Math.PI) / 180
  const dir: Point2D = [Math.cos(θ), Math.sin(θ)]
  const alongX = Math.abs(dir[0]) >= Math.abs(dir[1])

  const frame = computeFrame(spec, profiles)
  const support = resolveWingShelfSupport({
    contour: pts,
    params: {
      ...DEFAULT_PLAN_CONSTRUCTION_PARAMS,
      lamellaDirectionDeg: spec.lamellaDirectionDeg,
      beamProfileId: spec.beamProfileId,
      postProfileId: spec.postProfileId,
      purlinProfileId: spec.purlinProfileId ?? DEFAULT_PLAN_CONSTRUCTION_PARAMS.purlinProfileId,
      purlinDividers: spec.purlinDividers ?? { mode: 'auto' },
      measuredOuterLengthMmByEdgeIndex: spec.measuredOuterLengthMmByEdgeIndex,
      purlinClearLayoutVersion: spec.purlinClearLayoutVersion,
      purlinMaxSpanMm: spec.purlinMaxSpanMm,
      postMaxSpanMm: spec.postMaxSpanMm,
      wingShelfProfileId: spec.wingShelfProfileId,
      wallProfileId: spec.wallProfileId,
      wallBeamWidthVersion: spec.wallBeamWidthVersion,
    },
    profiles,
    beams: frame.beams,
    wallEdgeIndices: spec.wallEdgeIndices,
  })

  const supportW = supportBandWidthMm(support, frame.beams, profiles, spec.beamProfileId, spec.wallBeamWidthVersion === 1)
  const supportHalf = supportW / 2
  // A wall notch narrower than the free beam was grown to the free-beam half.
  // Pull it back onto the wall's own face. 50 vs 40 keeps the live-L heights
  // (3380 / 2920). Double-T 70 vs wall 40 lands on the wall faces, so the
  // upper clear is 4000 − 70 − 40 and the lower clear is 4000 − 40.
  if (supportW + 0.5 < beamW && cutouts.length > 0) {
    const opened = cutouts.map((cut) => pullNarrowWallNotchIntoUpperBay(cut, pts, beamW, widthAt))
    const moved = opened.some((cut, i) => Math.abs(cut.maxY - cutouts[i].maxY) > 0.5)
    if (moved) {
      cutouts = opened
      field = subtractAll([aabb], cutouts)
    }
  }

  // The shelf span already ends on the cutout beam's inner face. A cutout
  // grown by the full wall width stops short of that face; snap the vertical
  // edge to the shelf end so the last bay uses the same face.
  if (support && support.lengthMm > 1 && cutouts.length > 0) {
    const shelfXs = [support.start[0], support.end[0]]
    let snapped = false
    for (const cut of cutouts) {
      for (const x of shelfXs) {
        if (x > cut.minX + 0.5 && x - cut.minX <= beamW + 0.5) {
          cut.minX = x
          snapped = true
        } else if (x < cut.maxX - 0.5 && cut.maxX - x <= beamW + 0.5) {
          cut.maxX = x
          snapped = true
        }
      }
    }
    if (snapped) field = subtractAll([aabb], cutouts)
  }

  const pattern = resolveLamellaPattern(spec, profiles)
  const purlinProfile = spec.purlinProfileId ? profiles.get(spec.purlinProfileId) : undefined
  const positions =
    purlinProfile?.interruptsLamella === true
      ? resolveContourPurlinPositions({
          contour: pts,
          lamellaDirectionDeg: spec.lamellaDirectionDeg,
          maxSpanMm: patternMaxLamellaSpanMm(pattern),
          mode: spec.purlinDividers?.mode,
          lines: spec.purlinDividers?.lines,
          profiles,
          beamProfileId: spec.beamProfileId,
          wallProfileId: spec.wallProfileId,
          wallEdgeIndices: spec.wallEdgeIndices,
          wallBeamWidthVersion: spec.wallBeamWidthVersion,
          measuredOuterLengthMmByEdgeIndex: spec.measuredOuterLengthMmByEdgeIndex,
          layoutVersion: spec.purlinClearLayoutVersion === 1 ? 1 : undefined,
        })
      : []

  const purlinObstacles: Rectangle[] = []
  const supportObstacles: Rectangle[] = []
  const verticalFaces: FaceBand[] = []
  const horizontalFaces: FaceBand[] = []

  for (const pos of positions) {
    if (alongX) {
      const band: Rectangle = {
        minX: pos.positionMm - purlinHalf,
        maxX: pos.positionMm + purlinHalf,
        minY: aabb.minY - 1,
        maxY: aabb.maxY + 1,
      }
      purlinObstacles.push(band)
      verticalFaces.push({
        a0: band.minX,
        a1: band.maxX,
        t0: band.minY,
        t1: band.maxY,
        kind: 'purlin',
      })
    } else {
      const band: Rectangle = {
        minX: aabb.minX - 1,
        maxX: aabb.maxX + 1,
        minY: pos.positionMm - purlinHalf,
        maxY: pos.positionMm + purlinHalf,
      }
      purlinObstacles.push(band)
      horizontalFaces.push({
        a0: band.minY,
        a1: band.maxY,
        t0: band.minX,
        t1: band.maxX,
        kind: 'purlin',
      })
    }
  }

  if (support && support.lengthMm > 1) {
    const y0 = Math.min(support.start[1], support.end[1])
    const y1 = Math.max(support.start[1], support.end[1])
    const x0 = Math.min(support.start[0], support.end[0])
    const x1 = Math.max(support.start[0], support.end[0])
    const midY = (y0 + y1) / 2
    const midX = (x0 + x1) / 2
    const horizontal = Math.abs(x1 - x0) >= Math.abs(y1 - y0)
    if (horizontal) {
      const cutoutTop = cutouts.length > 0 ? Math.max(...cutouts.map((c) => c.maxY)) : midY + supportHalf
      const spanMinX = Math.min(aabb.minX, ...field.map((r) => r.minX))
      const spanMaxX = cutouts.length > 0 ? Math.min(...cutouts.map((c) => c.minX)) : Math.max(x0, x1)
      // A shelf that sits on a frame beam keeps the beam-face band. A shelf
      // with no beam under it (the left wing) occupies its own plan width
      // on the notch axis, so the cells stop on the shelf faces.
      const onBeam = supportRestsOnBeamSegment(support, frame.beams)
      const shelfId = support.profileId || spec.wingShelfProfileId || ''
      const shelfW = shelfId ? beamPlanWidthForDrawing(profiles, shelfId).planWidthMm : supportW
      const band: Rectangle = onBeam
        ? {
            minX: spanMinX,
            maxX: spanMaxX,
            minY: cutoutTop - supportW,
            maxY: cutoutTop,
          }
        : {
            minX: spanMinX,
            maxX: spanMaxX,
            minY: midY - shelfW / 2,
            maxY: midY + shelfW / 2,
          }
      supportObstacles.push(band)
      horizontalFaces.push({
        a0: band.minY,
        a1: band.maxY,
        t0: band.minX,
        t1: band.maxX,
        kind: 'support',
      })
    } else {
      const band: Rectangle = {
        minX: midX - supportHalf,
        maxX: midX + supportHalf,
        minY: Math.min(y0, aabb.minY),
        maxY: Math.max(y1, aabb.maxY),
      }
      supportObstacles.push(band)
      verticalFaces.push({
        a0: band.minX,
        a1: band.maxX,
        t0: band.minY,
        t1: band.maxY,
        kind: 'support',
      })
    }
  }

  for (const cut of cutouts) {
    verticalFaces.push({
      a0: cut.minX,
      a1: cut.minX,
      t0: cut.minY,
      t1: cut.maxY,
      kind: 'notch',
    })
    horizontalFaces.push({
      a0: cut.maxY,
      a1: cut.maxY,
      t0: cut.minX,
      t1: cut.maxX,
      kind: 'notch',
    })
  }
  verticalFaces.push(
    { a0: aabb.minX, a1: aabb.minX, t0: aabb.minY, t1: aabb.maxY, kind: 'frame' },
    { a0: aabb.maxX, a1: aabb.maxX, t0: aabb.minY, t1: aabb.maxY, kind: 'frame' },
  )
  horizontalFaces.push(
    { a0: aabb.minY, a1: aabb.minY, t0: aabb.minX, t1: aabb.maxX, kind: 'frame' },
    { a0: aabb.maxY, a1: aabb.maxY, t0: aabb.minX, t1: aabb.maxX, kind: 'frame' },
  )

  const afterSupport = mergeAdjacentRects(subtractAll(field, supportObstacles))
  const cells = subtractAll(afterSupport, purlinObstacles)
  const pitchMm = representativePitchMm(pattern, spec.lamellaGapMm)
  const sections: LamellaSection[] = []
  let id = 0

  for (const cell of cells) {
    const cx = (cell.minX + cell.maxX) / 2
    const cy = (cell.minY + cell.maxY) / 2
    if (!pointInPolygon([cx, cy], pts)) continue
    const clearX = cell.maxX - cell.minX
    const clearY = cell.maxY - cell.minY
    const clearW = alongX ? clearX : clearY
    const clearH = alongX ? clearY : clearX
    const { widthMm, heightMm } = factorySectionSizeMm(clearW, clearH)
    if (widthMm < MIN_CELL_MM || heightMm < MIN_CELL_MM) continue
    const lamellaCount = countRowsInHeight(heightMm, pattern, spec.lamellaGapMm)
    if (lamellaCount <= 0) continue
    const padW = clearW - widthMm
    const padH = clearH - heightMm
    const faceX0 = classifyFace(cell.minX, cell.minY, cell.maxY, verticalFaces, 'frame')
    const faceX1 = classifyFace(cell.maxX, cell.minY, cell.maxY, verticalFaces, 'frame')
    const faceY0 = classifyFace(cell.minY, cell.minX, cell.maxX, horizontalFaces, 'frame')
    const faceY1 = classifyFace(cell.maxY, cell.minX, cell.maxX, horizontalFaces, 'frame')
    sections.push({
      id: `sec-${id++}`,
      widthMm,
      heightMm,
      clearWMm: clearW,
      clearHMm: clearH,
      lamellaCount,
      pitchMm,
      minX: alongX ? cell.minX + padW / 2 : cell.minX + padH / 2,
      maxX: alongX ? cell.maxX - padW / 2 : cell.maxX - padH / 2,
      minY: alongX ? cell.minY + padH / 2 : cell.minY + padW / 2,
      maxY: alongX ? cell.maxY - padH / 2 : cell.maxY - padW / 2,
      faceX0,
      faceX1,
      faceY0,
      faceY1,
    })
  }

  sections.sort((a, b) => b.minY - a.minY || a.minX - b.minX)
  const numbered = sections.map((s, i) => ({ ...s, id: `sec-${i}` }))
  const skewed = applySkewSectionLengths(numbered, pts, spec, pattern, widthAt)
  if (skewed.length > 0 || spec.skewSectionVersion !== 1) return skewed
  return openSkewBaySections({
    pts,
    spec,
    pattern,
    widthAt,
    positions,
    support,
    supportW,
  })
}

interface SkewEndFace {
  start: Point2D
  end: Point2D
  halfMm: number
  alongAt: (stack: number) => number | null
  inwardOfAxis: (along: number, stack: number) => boolean
  overlapsStack: (stack0: number, stack1: number) => boolean
}

function distPointToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-6) return Math.hypot(p[0] - a[0], p[1] - a[1])
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2))
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby))
}

function alongOnLine(origin: Point2D, delta: Point2D, dir: Point2D, perp: Point2D, stack: number): number | null {
  const denom = delta[0] * perp[0] + delta[1] * perp[1]
  if (Math.abs(denom) < 1e-6) return null
  const originStack = origin[0] * perp[0] + origin[1] * perp[1]
  const u = (stack - originStack) / denom
  const x = origin[0] + u * delta[0]
  const y = origin[1] + u * delta[1]
  return x * dir[0] + y * dir[1]
}

function angleFromUnitDeg(dx: number, dy: number, unit: Point2D): number {
  const len = Math.hypot(dx, dy)
  if (len < 1) return 0
  const dot = Math.abs((dx / len) * unit[0] + (dy / len) * unit[1])
  return (Math.acos(Math.min(1, dot)) * 180) / Math.PI
}

/**
 * Inner face of each contour edge that is not within 1.5° of square to the
 * lamella and not a side the rows stack along. Joint angles are not read.
 */
function skewEndFaces(
  pts: Point2D[],
  dir: Point2D,
  perp: Point2D,
  widthAt: (edgeIndex: number) => number,
): SkewEndFace[] {
  const faces: SkewEndFace[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1) continue
    const fromPerp = angleFromUnitDeg(dx, dy, perp)
    if (fromPerp <= SKEW_END_TOL_DEG || fromPerp >= 45) continue
    const half = widthAt(i) / 2
    const nx = -dy / len
    const ny = dx / len
    const origin: Point2D = [a[0] + nx * half, a[1] + ny * half]
    const end: Point2D = [b[0] + nx * half, b[1] + ny * half]
    const aStack = a[0] * perp[0] + a[1] * perp[1]
    const bStack = b[0] * perp[0] + b[1] * perp[1]
    faces.push({
      start: origin,
      end,
      halfMm: half,
      alongAt: (stack) => alongOnLine(origin, [dx, dy], dir, perp, stack),
      inwardOfAxis: (along, stack) => {
        const denom = dx * perp[0] + dy * perp[1]
        if (Math.abs(denom) < 1e-6) return false
        const u = (stack - aStack) / denom
        const onAxis: Point2D = [a[0] + u * dx, a[1] + u * dy]
        const p: Point2D = Math.abs(dir[0]) >= Math.abs(dir[1]) ? [along, stack] : [stack, along]
        return (p[0] - onAxis[0]) * nx + (p[1] - onAxis[1]) * ny > 0
      },
      overlapsStack: (stack0, stack1) => {
        const lo = Math.min(aStack, bStack)
        const hi = Math.max(aStack, bStack)
        return Math.min(stack1, hi) - Math.max(stack0, lo) > half
      },
    })
  }
  return faces
}

function pointOnRun(alongX: boolean, along: number, stack: number): Point2D {
  return alongX ? [along, stack] : [stack, along]
}

/**
 * Replace a rectangular cell with a trapezoid when one end is a skew beam.
 * Each lamella takes the narrowest clearance inside its own row, minus 15.
 */
function applySkewSectionLengths(
  sections: LamellaSection[],
  pts: Point2D[],
  spec: PergolaSpec,
  pattern: LamellaPatternEntry[],
  widthAt: (edgeIndex: number) => number,
): LamellaSection[] {
  if (spec.skewSectionVersion !== 1 || sections.length === 0 || pattern.length === 0) return sections
  const θ = (spec.lamellaDirectionDeg * Math.PI) / 180
  const run: Point2D = [Math.cos(θ), Math.sin(θ)]
  const alongX = Math.abs(run[0]) >= Math.abs(run[1])
  const dir: Point2D = alongX ? [1, 0] : [0, 1]
  const perp: Point2D = alongX ? [0, 1] : [1, 0]
  const faces = skewEndFaces(pts, dir, perp, widthAt)
  if (faces.length === 0) return sections
  const step = spec.lamellaLengthStepMm != null && spec.lamellaLengthStepMm > 0
    ? spec.lamellaLengthStepMm
    : DEFAULT_LAMELLA_LENGTH_STEP_MM
  const inset = LAMELLA_SECTION_CLEARANCE_W_MM / 2

  return sections.map((section) => {
    const padAlong = (section.clearWMm - section.widthMm) / 2
    const padStack = (section.clearHMm - section.heightMm) / 2
    const clear0 = (alongX ? section.minX : section.minY) - padAlong
    const clear1 = (alongX ? section.maxX : section.maxY) + padAlong
    const stack0 = (alongX ? section.minY : section.minX) - padStack
    const stack1 = (alongX ? section.maxY : section.maxX) + padStack
    const drawn0 = alongX ? section.minY : section.minX
    const drawn1 = alongX ? section.maxY : section.maxX
    const midStack = (stack0 + stack1) / 2
    let replace0: ((stack: number) => number) | null = null
    let replace1: ((stack: number) => number) | null = null

    for (const face of faces) {
      if (!face.overlapsStack(stack0, stack1)) continue
      if (!face.inwardOfAxis((clear0 + clear1) / 2, midStack)) continue
      const at0 = face.alongAt(stack0)
      const at1 = face.alongAt(stack1)
      if (at0 == null || at1 == null) continue
      const travel = Math.abs(at1 - at0)
      const tol = Math.max(face.halfMm * 2, travel * 0.5 + face.halfMm)
      const ends: Array<{ along: number; which: 0 | 1; kind: LamellaSectionFace }> = [
        { along: clear0, which: 0, kind: alongX ? section.faceX0 : section.faceY0 },
        { along: clear1, which: 1, kind: alongX ? section.faceX1 : section.faceY1 },
      ]
      for (const end of ends) {
        if (end.kind === 'purlin' || end.kind === 'support') continue
        const probe = pointOnRun(alongX, end.along, midStack)
        if (distPointToSegment(probe, face.start, face.end) > tol) continue
        if (end.which === 0) replace0 = (stack) => face.alongAt(stack) ?? end.along
        else replace1 = (stack) => face.alongAt(stack) ?? end.along
      }
    }
    if (replace0 == null && replace1 == null) return section

    const leftAt = replace0 ?? ((_: number) => clear0)
    const rightAt = replace1 ?? ((_: number) => clear1)
    const widthAtStack = (stack: number) => rightAt(stack) - inset - (leftAt(stack) + inset)
    const widthAtLowMm = widthAtStack(drawn0)
    const widthAtHighMm = widthAtStack(drawn1)
    if (!(widthAtLowMm > MIN_CELL_MM) || !(widthAtHighMm > MIN_CELL_MM)) return section
    if (Math.abs(widthAtHighMm - widthAtLowMm) <= LAMELLA_SECTION_TYPE_TOLERANCE_MM) return section

    const left = (stack: number) => leftAt(stack) + inset
    const right = (stack: number) => rightAt(stack) - inset
    const corners: LamellaTrapezoid['corners'] = [
      pointOnRun(alongX, left(drawn0), drawn0),
      pointOnRun(alongX, right(drawn0), drawn0),
      pointOnRun(alongX, right(drawn1), drawn1),
      pointOnRun(alongX, left(drawn1), drawn1),
    ]
    const lamellaLengthsMm: number[] = []
    const upperFromTopMm: number[] = []
    let scan = pattern[0].visibleWidthMm * 0.5
    let i = 0
    for (let row = 0; row < section.lamellaCount; row++) {
      const entry = pattern[i % pattern.length]
      const next = pattern[(i + 1) % pattern.length]
      const half = entry.visibleWidthMm * 0.5
      const band0 = drawn0 + scan - half
      const band1 = drawn0 + scan + half
      lamellaLengthsMm.push(floorLamellaLengthMm(Math.min(widthAtStack(band0), widthAtStack(band1)), step))
      upperFromTopMm.push(drawn1 - band1)
      scan += half + spec.lamellaGapMm + next.visibleWidthMm * 0.5
      i += 1
    }
    const trapezoid: LamellaTrapezoid = { corners, widthAtLowMm, widthAtHighMm, lamellaLengthsMm, upperFromTopMm }
    return { ...section, trapezoid }
  })
}

function trapezoidSpanAt(
  corners: LamellaTrapezoid['corners'],
  alongX: boolean,
  stack: number,
): { start: number; end: number } {
  const [lowL, lowR, highR, highL] = corners
  const stack0 = alongX ? lowL[1] : lowL[0]
  const stack1 = alongX ? highL[1] : highL[0]
  const t = stack1 === stack0 ? 0 : (stack - stack0) / (stack1 - stack0)
  const lerp = (a: number, b: number) => a + t * (b - a)
  if (alongX) return { start: lerp(lowL[0], highL[0]), end: lerp(lowR[0], highR[0]) }
  return { start: lerp(lowL[1], highL[1]), end: lerp(lowR[1], highR[1]) }
}

/**
 * Per-column checksum: Σ(H + 30) + support widths + frame widths = measured outer.
 * Left of the live L: (3370+30)+(2920+30)+50+50+50 = 6500.
 * Right: (3370+30)+50+50 = 3500.
 */
export function columnHeightChecksums(
  sections: LamellaSection[],
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
): ColumnHeightChecksum[] {
  if (sections.length === 0) return []
  const beamW = beamPlanWidthForDrawing(profiles, spec.beamProfileId).planWidthMm
  const supportW = supportLineObstacleWidthMm(profiles, spec.beamProfileId)
  const pts = sanitizeContour(spec.contour)
  const outerY =
    measuredOuterAlongLamellas(pts, spec.lamellaDirectionDeg + 90, spec.measuredOuterLengthMmByEdgeIndex)
    ?? (Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])))
  const acrossOuterByX = new Map<number, number>()
  if (spec.measuredOuterLengthMmByEdgeIndex) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      if (Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1])) continue
      const measured = spec.measuredOuterLengthMmByEdgeIndex[i]
      if (typeof measured !== 'number' || measured <= 0) continue
      const midX = (a[0] + b[0]) / 2
      acrossOuterByX.set(midX, measured)
    }
  }

  const columns = new Map<string, LamellaSection[]>()
  for (const s of sections) {
    const mid = (s.minX + s.maxX) / 2
    const stack = sections
      .filter((t) => t.minX < mid - EPS && t.maxX > mid + EPS)
      .sort((a, b) => a.minY - b.minY)
    const key = stack.map((t) => t.id).join('|')
    if (!columns.has(key)) columns.set(key, stack)
  }

  const out: ColumnHeightChecksum[] = []
  let n = 0
  for (const stack of columns.values()) {
    const midX = stack.reduce((acc, s) => acc + (s.minX + s.maxX) / 2, 0) / stack.length
    const minClearY = Math.min(...stack.map((s) => s.minY - (s.clearHMm - s.heightMm) / 2))
    const fieldBottom = Math.min(...sections.map((s) => s.minY - (s.clearHMm - s.heightMm) / 2))
    const isFullHeight = minClearY <= fieldBottom + 2
    let measured = outerY
    if (!isFullHeight) {
      const wings = [...acrossOuterByX.values()].filter((mm) => mm < outerY - 1)
      measured = wings.length > 0 ? Math.max(...wings) : outerY
    } else if (acrossOuterByX.size > 0) {
      measured = Math.max(...acrossOuterByX.values())
    }

    const parts: Array<{ label: string; mm: number }> = [
      { label: 'frame-bottom', mm: beamW },
      { label: 'frame-top', mm: beamW },
    ]
    let sum = 2 * beamW
    const sorted = [...stack].sort((a, b) => a.minY - b.minY)
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i]
      parts.push({ label: `${s.id} H+30`, mm: s.heightMm + LAMELLA_SECTION_CLEARANCE_H_MM })
      sum += s.heightMm + LAMELLA_SECTION_CLEARANCE_H_MM
      if (i + 1 < sorted.length) {
        const gap = (sorted[i + 1].minY - (sorted[i + 1].clearHMm - sorted[i + 1].heightMm) / 2)
          - (s.maxY + (s.clearHMm - s.heightMm) / 2)
        const supportHere = Math.abs(gap - supportW) <= 2 || s.faceY1 === 'support' || sorted[i + 1].faceY0 === 'support'
        if (supportHere) {
          // The band between the two cells is what was subtracted: the frame
          // beam face band (supportW), or the shelf's own width where no beam
          // sits under it. A fixed supportW over-counted a 40 mm shelf by 10.
          const bandMm = gap > 0 ? Math.round(gap * 10) / 10 : supportW
          parts.push({ label: 'support', mm: bandMm })
          sum += bandMm
        }
      }
    }
    out.push({
      id: `col-${n++}`,
      midX,
      measuredOuterMm: measured,
      sumMm: sum,
      closes: Math.abs(sum - measured) <= 0.6,
      parts,
    })
  }
  return out
}

export function computeLamellasFromSections(
  spec: PergolaSpec,
  profiles: Map<string, ProfileDimensions>,
  sections: LamellaSection[],
  roof?: RoofPlane,
): CutPiece[] {
  const pattern = resolveLamellaPattern(spec, profiles)
  const plane = roof ?? roofPlane(spec)
  const sloped = !isHorizontalPlane(plane)
  const θ = spec.lamellaDirectionDeg * Math.PI / 180
  const dir: Point2D = [Math.cos(θ), Math.sin(θ)]
  const alongX = Math.abs(dir[0]) >= Math.abs(dir[1])
  const effectiveTiltDeg = spec.lamellaOnEdge ? spec.lamellaAngleDeg + 90 : spec.lamellaAngleDeg
  const pieces: CutPiece[] = []
  let id = 0

  for (const section of sections) {
    let scan = pattern[0].visibleWidthMm * 0.5
    let i = 0
    for (let row = 0; row < section.lamellaCount; row++) {
      const entry = pattern[i % pattern.length]
      const next = pattern[(i + 1) % pattern.length]
      const trap = section.trapezoid
      let startAlong = alongX ? section.minX : section.minY
      let length = section.widthMm
      if (trap) {
        const half = entry.visibleWidthMm * 0.5
        const origin = alongX ? section.minY : section.minX
        const band0 = origin + scan - half
        const band1 = origin + scan + half
        const a = trapezoidSpanAt(trap.corners, alongX, band0)
        const b = trapezoidSpanAt(trap.corners, alongX, band1)
        startAlong = Math.max(a.start, b.start)
        length = trap.lamellaLengthsMm[row] ?? length
      }
      const start: Point2D = alongX
        ? [startAlong, section.minY + scan]
        : [section.minX + scan, startAlong]
      const end: Point2D = alongX
        ? [startAlong + length, section.minY + scan]
        : [section.minX + scan, startAlong + length]
      const placed = sloped
        ? placeOnRoof(start, end, plane, effectiveTiltDeg * Math.PI / 180)
        : null
      const axisMm = trap ? length : (placed?.axisMm ?? section.widthMm)
      if (!(axisMm > 1)) {
        scan += entry.visibleWidthMm * 0.5 + spec.lamellaGapMm + next.visibleWidthMm * 0.5
        i += 1
        continue
      }
      pieces.push({
        id: `lamella-${id++}`,
        role: 'lamella',
        profileId: entry.profileId,
        lengthAxisMm: axisMm,
        lengthLongMm: axisMm,
        lengthShortMm: axisMm,
        cutMiterStartDeg: 0,
        cutBevelStartDeg: effectiveTiltDeg,
        cutHandStart: 'straight',
        cutMiterEndDeg: 0,
        cutBevelEndDeg: effectiveTiltDeg,
        cutHandEnd: 'straight',
        position: placed?.position ?? [start[0], spec.heightMm, start[1]],
        rotation: placed?.rotation ?? [effectiveTiltDeg * Math.PI / 180, -θ, 0],
        color: spec.color,
      })
      scan += entry.visibleWidthMm * 0.5 + spec.lamellaGapMm + next.visibleWidthMm * 0.5
      i += 1
    }
  }
  return pieces
}
