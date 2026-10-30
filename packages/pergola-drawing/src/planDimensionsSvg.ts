/**
 * Server-safe SVG for top-plan dimensions (no React). Same geometry as
 * TopPlanSheet + dimensionLayout — fed by `buildTopPlanDimensionModel`.
 */

import {
  formatPurlinClearLabelMm,
  type AxialEdgeRef,
  type Point2D,
  type TopPlanDimensionModel,
} from '@pashkovsky/pergola-core'
import { buildDimensionLineLayout, outwardNormal } from './geometry/dimensionLayout'

const PERIMETER_OFFSET_MM = 500
const PURLIN_OFFSET_MM = 325
const DIM_FONT = 220
const ANGLE_FONT = 180
const ANGLE_LABEL_OFFSET_MM = 450
/** Half of "257.5°" at ANGLE_FONT, so the glyphs stay inside the viewBox. */
const ANGLE_TEXT_PAD_MM = ANGLE_FONT * 3.6

function inwardBisector(vertex: Point2D, prev: Point2D, next: Point2D, centroid: Point2D): Point2D {
  const uIn = unit(sub(vertex, prev))
  const uOut = unit(sub(next, vertex))
  const leftIn: Point2D = [-uIn[1], uIn[0]]
  const leftOut: Point2D = [-uOut[1], uOut[0]]
  let bis = unit([leftIn[0] + leftOut[0], leftIn[1] + leftOut[1]])
  if (Math.hypot(bis[0], bis[1]) < 1e-6) bis = leftIn
  const toCenter = sub(centroid, vertex)
  if (bis[0] * toCenter[0] + bis[1] * toCenter[1] < 0) bis = [-bis[0], -bis[1]]
  return bis
}

export function angleLabelWorldPoint(
  vertex: Point2D,
  prev: Point2D,
  next: Point2D,
  centroid: Point2D,
  offsetMm: number = ANGLE_LABEL_OFFSET_MM,
): Point2D {
  return add(vertex, scale(inwardBisector(vertex, prev, next, centroid), offsetMm))
}

function distPointToSegment(point: Point2D, start: Point2D, end: Point2D): number {
  if (!start || !end) return Infinity
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const len2 = dx * dx + dy * dy
  if (len2 < 1e-9) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / len2))
  return Math.hypot(point[0] - (start[0] + dx * t), point[1] - (start[1] + dy * t))
}

/**
 * Interior label that stays off dimension lines and off the beam.
 * The two edges that meet at the vertex are ignored near the corner.
 */
export function angleLabelClearPoint(
  vertex: Point2D,
  prev: Point2D,
  next: Point2D,
  centroid: Point2D,
  obstacles: Array<[Point2D, Point2D]>,
  clearanceMm = 420,
): Point2D {
  const bis = inwardBisector(vertex, prev, next, centroid)
  const side: Point2D = [-bis[1], bis[0]]
  const samples = (point: Point2D) => [
    point,
    add(point, scale(side, 420)),
    add(point, scale(side, -420)),
    add(point, scale(bis, 180)),
    add(point, scale(bis, -180)),
  ]
  const blocked = (point: Point2D) => samples(point).some((sample) =>
    obstacles.some(([start, end]) => distPointToSegment(sample, start, end) < clearanceMm),
  )
  for (const offset of [280, 420, 640, 900, 1280, 1680]) {
    const point = add(vertex, scale(bis, offset))
    if (!blocked(point)) return point
  }
  for (const offset of [480, 860, 1280, 1700]) {
    for (const sign of [1, -1]) {
      const point = add(add(vertex, scale(bis, offset)), scale(side, sign * 420))
      if (!blocked(point)) return point
    }
  }
  return add(vertex, scale(bis, 1280))
}

function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}
function add(a: Point2D, b: Point2D): Point2D {
  return [a[0] + b[0], a[1] + b[1]]
}
function scale(a: Point2D, s: number): Point2D {
  return [a[0] * s, a[1] * s]
}
function unit(a: Point2D): Point2D {
  const l = Math.hypot(a[0], a[1])
  return l > 1e-9 ? [a[0] / l, a[1] / l] : [1, 0]
}

function interiorArcPolyline(
  vertex: Point2D,
  prev: Point2D,
  next: Point2D,
  radiusMm: number,
  steps: number,
): Point2D[] {
  const uIn = unit(sub(vertex, prev))
  const uOut = unit(sub(next, vertex))
  const a0 = Math.atan2(uIn[1], uIn[0])
  const a1 = Math.atan2(uOut[1], uOut[0])
  let sweep = a1 - a0
  while (sweep <= -Math.PI) sweep += 2 * Math.PI
  while (sweep > Math.PI) sweep -= 2 * Math.PI
  const pts: Point2D[] = []
  for (let i = 0; i <= steps; i++) {
    const a = a0 + sweep * (i / steps)
    pts.push([vertex[0] + Math.cos(a) * radiusMm, vertex[1] + Math.sin(a) * radiusMm])
  }
  return pts
}

function readableLabelAngleDeg(dx: number, dy: number): number {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI
  if (deg > 90) return deg - 180
  if (deg < -90) return deg + 180
  return deg
}

export interface PlanDimensionsSvgInput {
  contour: Point2D[]
  model: TopPlanDimensionModel
  geometricSides: AxialEdgeRef[]
  centroid: Point2D
  lamellaDirectionDeg: number
  /** Stock-splice points on a straight side. Drawn as dots, not as corners. */
  splicePoints?: Point2D[]
}

export function collectPlanDimensionWorldPoints(input: PlanDimensionsSvgInput): Point2D[] {
  const { contour, model, geometricSides, centroid, lamellaDirectionDeg } = input
  const points: Point2D[] = [...contour]
  for (let i = 0; i < model.perimeterChains.length; i++) {
    const side = geometricSides[i]
    const outward = outwardNormal(side.start, side.end, centroid)
    const layout = buildDimensionLineLayout(model.perimeterChains[i], outward, PERIMETER_OFFSET_MM)
    for (const ext of layout.extensionLines) {
      points.push(ext.from, ext.to)
    }
    for (const seg of layout.segments) {
      points.push(seg.labelAnchor)
    }
  }
  if (model.purlinClearChain) {
    const θ = (lamellaDirectionDeg * Math.PI) / 180
    const dir: Point2D = [Math.cos(θ), Math.sin(θ)]
    const outward: Point2D = [-dir[1], dir[0]]
    const layout = buildDimensionLineLayout(model.purlinClearChain, outward, PURLIN_OFFSET_MM)
    for (const ext of layout.extensionLines) points.push(ext.from, ext.to)
    for (const seg of layout.segments) points.push(seg.labelAnchor)
  }
  for (const entry of model.vertexAngles) {
    const n = contour.length
    const prev = contour[(entry.vertexIndex + n - 1) % n]
    const next = contour[(entry.vertexIndex + 1) % n]
    points.push(...interiorArcPolyline(entry.vertex, prev, next, 320, 8))
    points.push(angleLabelWorldPoint(entry.vertex, prev, next, centroid))
  }
  return points
}

function dimensionChainMarkup(
  layout: ReturnType<typeof buildDimensionLineLayout>,
  screen: (p: Point2D) => { x: number; y: number },
  stroke: string,
  extStroke: string,
  options?: { formatLengthMm?: (mm: number) => string; showSegmentLabels?: boolean },
): string {
  const formatLengthMm = options?.formatLengthMm ?? ((m: number) => String(Math.round(m)))
  const showSegmentLabels = options?.showSegmentLabels ?? true
  const lines: string[] = []
  for (const ext of layout.extensionLines) {
    const a = screen(ext.from)
    const b = screen(ext.to)
    lines.push(
      `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${extStroke}" stroke-width="40"/>`,
    )
  }
  for (const seg of layout.segments) {
    const a = screen(seg.fromOffsetPoint)
    const b = screen(seg.toOffsetPoint)
    const anchor = screen(seg.labelAnchor)
    const angle = readableLabelAngleDeg(b.x - a.x, b.y - a.y)
    lines.push(
      `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${stroke}" stroke-width="40"/>`,
    )
    if (showSegmentLabels) {
      lines.push(
        `<text x="${anchor.x.toFixed(1)}" y="${anchor.y.toFixed(1)}" transform="rotate(${angle.toFixed(2)}, ${anchor.x.toFixed(1)}, ${anchor.y.toFixed(1)}) translate(0, -80)" text-anchor="middle" font-size="${DIM_FONT}" font-family="Arial, sans-serif" fill="${stroke}">${formatLengthMm(seg.lengthMm)}</text>`,
      )
    }
  }
  return lines.join('')
}

export function renderPlanDimensionsSvg(input: PlanDimensionsSvgInput): string {
  const { contour, model, geometricSides, centroid, lamellaDirectionDeg } = input
  const allPoints = collectPlanDimensionWorldPoints(input)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of allPoints) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  const margin = 400 + ANGLE_TEXT_PAD_MM
  minX -= margin
  maxX += margin
  minY -= margin
  maxY += margin
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  const screen = (p: Point2D) => ({ x: p[0] - minX, y: maxY - p[1] })

  const poly = contour
    .map((p) => {
      const s = screen(p)
      return `${s.x.toFixed(1)},${s.y.toFixed(1)}`
    })
    .join(' ')

  const parts: string[] = [
    `<polygon points="${poly}" fill="#f8fafc" stroke="#0f172a" stroke-width="40"/>`,
  ]
  for (const point of input.splicePoints ?? []) {
    const s = screen(point)
    parts.push(
      `<circle data-beam-splice="1" cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="28" fill="#111827"/>`,
    )
  }
  if (model.angleClosureWarning) {
    parts.push(
      `<text x="40" y="80" font-size="48" font-family="Arial, sans-serif" fill="#b91c1c">${model.angleClosureWarning}</text>`,
    )
  }

  for (let i = 0; i < model.perimeterChains.length; i++) {
    const side = geometricSides[i]
    const outward = outwardNormal(side.start, side.end, centroid)
    const layout = buildDimensionLineLayout(model.perimeterChains[i], outward, PERIMETER_OFFSET_MM)
    parts.push(dimensionChainMarkup(layout, screen, '#111827', '#9ca3af'))
  }

  if (model.purlinClearChain) {
    const θ = (lamellaDirectionDeg * Math.PI) / 180
    const dir: Point2D = [Math.cos(θ), Math.sin(θ)]
    const outward: Point2D = [-dir[1], dir[0]]
    const layout = buildDimensionLineLayout(model.purlinClearChain, outward, PURLIN_OFFSET_MM)
    const summary = model.purlinClearDisplaySummary
    if (summary && layout.segments.length > 0) {
      parts.push(dimensionChainMarkup(layout, screen, '#0f766e', '#5eead4', { showSegmentLabels: false }))
      const mid = layout.segments[Math.floor(layout.segments.length / 2)].labelAnchor
      const anchor = screen(mid)
      const first = layout.segments[0]
      const a = screen(first.fromOffsetPoint)
      const b = screen(first.toOffsetPoint)
      const angle = readableLabelAngleDeg(b.x - a.x, b.y - a.y)
      const clearLabel = summary.sectionClearLabel ?? formatPurlinClearLabelMm(summary.sectionClearMm)
      parts.push(
        `<text x="${anchor.x.toFixed(1)}" y="${anchor.y.toFixed(1)}" transform="rotate(${angle.toFixed(2)}, ${anchor.x.toFixed(1)}, ${anchor.y.toFixed(1)}) translate(0, -90)" text-anchor="middle" font-size="${DIM_FONT}" font-family="Arial, sans-serif" font-weight="600" fill="#0f766e">${summary.sectionCount}×${clearLabel}</text>`,
      )
    } else {
      parts.push(dimensionChainMarkup(layout, screen, '#0f766e', '#5eead4', {
        formatLengthMm: formatPurlinClearLabelMm,
      }))
    }
  }

  const n = contour.length
  for (const entry of model.vertexAngles) {
    const prev = contour[(entry.vertexIndex + n - 1) % n]
    const next = contour[(entry.vertexIndex + 1) % n]
    const arc = interiorArcPolyline(entry.vertex, prev, next, 320, 12)
      .map((p) => screen(p))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ')
    parts.push(`<polyline points="${arc}" fill="none" stroke="#4b5563" stroke-width="35"/>`)
    const labelPt = screen(angleLabelWorldPoint(entry.vertex, prev, next, centroid))
    parts.push(
      `<text x="${labelPt.x.toFixed(1)}" y="${labelPt.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${ANGLE_FONT}" font-family="Arial, sans-serif" fill="#374151">${entry.interiorAngleDeg.toFixed(1)}°</text>`,
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" width="520" height="360" data-plan-contour="1">${parts.join('')}</svg>`
}
