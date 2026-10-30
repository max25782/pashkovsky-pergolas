import type { Offer, PergolaPlan } from '@/types/offer'
import type { PlanConstructionParams, Point2D, ProfileDimensions } from '@pashkovsky/pergola-core'
import {
  PERGOLA_CONSTRUCTION_PROFILES,
  buildPiecesFromPlan,
  buildTopPlanDimensionModel,
  contourSideWidthMm,
  lamellaRunEndWidthsMm,
  resolvePlanPurlinLines,
} from '@pashkovsky/pergola-core'
import { beamSplicePoints, groupBeamsIntoGeometricSides, renderPlanDimensionsSvg } from '@pashkovsky/pergola-drawing/server'

const DIM_FONT = 220
const DIM_STROKE = 40
const DIM_GAP = 100
const DIM_CHAR_WIDTH = 0.62

export interface ContourDimensionLabel {
  edgeIndex: number
  text: string
  x: number
  y: number
  halfWidth: number
  halfHeight: number
}

function polygonSignedArea(polygon: Array<{ x: number; y: number }>): number {
  let sum = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    sum += current.x * next.y - next.x * current.y
  }
  return sum / 2
}

function segmentHitsAabb(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dy = by - ay
  const p = [-dx, dx, -dy, dy]
  const q = [ax - minX, maxX - ax, ay - minY, maxY - ay]
  for (let index = 0; index < 4; index += 1) {
    if (p[index] === 0) {
      if (q[index] < 0) return false
      continue
    }
    const ratio = q[index] / p[index]
    if (p[index] < 0) {
      if (ratio > t1) return false
      if (ratio > t0) t0 = ratio
    } else {
      if (ratio < t0) return false
      if (ratio < t1) t1 = ratio
    }
  }
  return t0 <= t1
}

function labelHitsContour(
  polygon: Array<{ x: number; y: number }>,
  label: ContourDimensionLabel,
): boolean {
  const minX = label.x - label.halfWidth
  const maxX = label.x + label.halfWidth
  const minY = label.y - label.halfHeight
  const maxY = label.y + label.halfHeight
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    if (segmentHitsAabb(current.x, current.y, next.x, next.y, minX, minY, maxX, maxY)) return true
  }
  return false
}

/**
 * @deprecated Axis edge lengths only — kept for regression snapshots of the
 * pre–TopPlanSheet PDF. Production PDF uses `planTopSheetSvg`.
 */
export function placeContourDimensionLabels(
  polygon: Array<{ x: number; y: number }>,
): ContourDimensionLabel[] {
  const ccw = polygonSignedArea(polygon) >= 0
  const labels: ContourDimensionLabel[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const dx = next.x - current.x
    const dy = next.y - current.y
    const lengthMm = Math.hypot(dx, dy)
    if (lengthMm < 1) continue
    let nx = dy / lengthMm
    let ny = -dx / lengthMm
    if (!ccw) {
      nx = -nx
      ny = -ny
    }
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    let ox = nx
    let oy = ny
    if (absDx >= absDy * 3) {
      ox = 0
      oy = ny >= 0 ? 1 : -1
    } else if (absDy >= absDx * 3) {
      ox = nx >= 0 ? 1 : -1
      oy = 0
    }
    const text = `${Math.round(lengthMm)}`
    const halfWidth = (text.length * DIM_FONT * DIM_CHAR_WIDTH) / 2
    const halfHeight = DIM_FONT / 2
    const reach = halfWidth * Math.abs(ox) + halfHeight * Math.abs(oy)
    let distance = reach + DIM_STROKE / 2 + DIM_GAP
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    let label: ContourDimensionLabel = {
      edgeIndex: index,
      text,
      x: midX + ox * distance,
      y: midY + oy * distance,
      halfWidth,
      halfHeight,
    }
    for (let step = 0; step < 12 && labelHitsContour(polygon, label); step += 1) {
      distance += DIM_FONT / 2
      label = {
        edgeIndex: index,
        text,
        x: midX + ox * distance,
        y: midY + oy * distance,
        halfWidth,
        halfHeight,
      }
    }
    labels.push(label)
  }
  return labels
}

/** Legacy axis-edge SVG (editor polygon vertices only). */
export function planContourSvgLegacy(
  polygon: Array<{ x: number; y: number }>,
  wallIndices: number[] = [],
): string {
  const labels = placeContourDimensionLabels(polygon)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  }
  for (const label of labels) {
    minX = Math.min(minX, label.x - label.halfWidth)
    maxX = Math.max(maxX, label.x + label.halfWidth)
    minY = Math.min(minY, label.y - label.halfHeight)
    maxY = Math.max(maxY, label.y + label.halfHeight)
  }
  const margin = 80
  minX -= margin
  maxX += margin
  minY -= margin
  maxY += margin
  const width = Math.max(maxX - minX, 1)
  const height = Math.max(maxY - minY, 1)
  const screen = (point: { x: number; y: number }) => ({
    x: point.x - minX,
    y: maxY - point.y,
  })
  const points = polygon.map((point) => {
    const mapped = screen(point)
    return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`
  }).join(' ')
  void wallIndices
  const labelMarkup = labels.map((label) => {
    const labelPt = screen(label)
    return `<text x="${labelPt.x.toFixed(1)}" y="${labelPt.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${DIM_FONT}" font-family="Arial, sans-serif" fill="#111827">${label.text}</text>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width.toFixed(1)} ${height.toFixed(1)}" width="520" height="360" data-plan-contour="legacy-axis"><polygon points="${points}" fill="#f8fafc" stroke="#0f172a" stroke-width="${DIM_STROKE}"/>${labelMarkup}</svg>`
}

function centroidOf(points: Point2D[]): Point2D {
  if (points.length === 0) return [0, 0]
  const sum = points.reduce<Point2D>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0])
  return [sum[0] / points.length, sum[1] / points.length]
}

/**
 * Top plan SVG aligned with TopPlanSheet: outer perimeter dims, interior
 * angles, purlin clear-span chain — via `buildTopPlanDimensionModel`.
 */
export function planTopSheetSvg(
  polygon: Array<{ x: number; y: number }>,
  wallIndices: number[],
  params: PlanConstructionParams,
  profiles: Map<string, ProfileDimensions> = PERGOLA_CONSTRUCTION_PROFILES,
): string {
  const contour: Point2D[] = polygon.map((p) => [p.x, p.y])
  const built = buildPiecesFromPlan({ contour, wallEdgeIndices: wallIndices, params }, profiles)
  const beams = built.pieces.filter((p) => p.role === 'beam')
  const geometricSides = groupBeamsIntoGeometricSides(beams)
  const drawContour: Point2D[] = geometricSides.map((s) => s.start)
  const centroid = centroidOf(drawContour)
  const dividerPositions = resolvePlanPurlinLines(contour, params, profiles, wallIndices)
  const endWidths = params.wallBeamWidthVersion === 1
    ? lamellaRunEndWidthsMm(contour, params.lamellaDirectionDeg ?? 0, profiles, {
        wallEdgeIndices: wallIndices,
        beamProfileId: params.beamProfileId,
        wallProfileId: params.wallProfileId,
        wallBeamWidthVersion: 1,
      })
    : null
  const model = buildTopPlanDimensionModel({
    geometricSides,
    beams,
    profiles,
    beamProfileId: params.beamProfileId,
    centroid,
    contourVertices: contour,
    lamellaDirectionDeg: params.lamellaDirectionDeg ?? 0,
    dividerPositions,
    measuredOuterLengthMmByEdgeIndex: params.measuredOuterLengthMmByEdgeIndex,
    purlinClearLayoutVersion: params.purlinClearLayoutVersion,
    ...(endWidths
      ? {
          leftEndWidthMm: endWidths.leftMm,
          rightEndWidthMm: endWidths.rightMm,
          planWidthForContourEdge: (edgeIndex: number) => contourSideWidthMm(profiles, edgeIndex, {
            wallEdgeIndices: wallIndices,
            beamProfileId: params.beamProfileId,
            wallProfileId: params.wallProfileId,
            wallBeamWidthVersion: 1,
          }),
        }
      : {}),
  })
  return renderPlanDimensionsSvg({
    contour: drawContour,
    model,
    geometricSides,
    centroid,
    lamellaDirectionDeg: params.lamellaDirectionDeg ?? 0,
    splicePoints: beamSplicePoints(beams),
  })
}

/**
 * Server-safe plan schematic for PDF / offer drawings.
 */
export function planContourSvg(
  polygon: Array<{ x: number; y: number }>,
  wallIndices: number[] = [],
  params?: PlanConstructionParams,
): string {
  if (params && polygon.length >= 3) {
    return planTopSheetSvg(polygon, wallIndices, params)
  }
  return planContourSvgLegacy(polygon, wallIndices)
}

async function drawingsFromContour(
  polygon: Array<{ x: number; y: number }>,
  wallIndices: number[],
  params?: PlanConstructionParams,
): Promise<OfferDrawings> {
  return {
    topPlan: planContourSvg(polygon, wallIndices, params),
    lamellaLayout: null,
  }
}

function legacyMetaPlan(offer: Offer): {
  polygon: Array<{ x: number; y: number }>
  wallIndices: number[]
  params: PlanConstructionParams
} | null {
  const meta = offer.configuratorMeta as {
    planPolygon?: Array<{ x: number; y: number }>
    planWallIndices?: number[]
    planParams?: PlanConstructionParams
  } | null
  if (!meta?.planPolygon || !Array.isArray(meta.planPolygon) || meta.planPolygon.length < 3) return null
  if (!meta.planParams) return null
  return {
    polygon: meta.planPolygon,
    wallIndices: meta.planWallIndices ?? [],
    params: meta.planParams,
  }
}

/** One pergola plan → top view + lamella sheet. Does not read configurator_meta. */
export async function generateDrawingsFromPlan(plan: PergolaPlan): Promise<OfferDrawings | null> {
  if (!plan.polygon || plan.polygon.length < 3) return null
  try {
    return await drawingsFromContour(plan.polygon, plan.wallIndices ?? [], plan.params)
  } catch (error) {
    console.error('[generateDrawingsFromPlan]', error)
    return null
  }
}

export async function generateTopPlanSvg(offer: Offer): Promise<string | null> {
  const legacy = legacyMetaPlan(offer)
  if (!legacy) return null
  try {
    const drawings = await drawingsFromContour(legacy.polygon, legacy.wallIndices, legacy.params)
    return drawings.topPlan
  } catch (error) {
    console.error('[generateTopPlanSvg]', error)
    return null
  }
}

export async function generateLamellaLayoutSvg(offer: Offer): Promise<string | null> {
  const legacy = legacyMetaPlan(offer)
  if (!legacy) return null
  try {
    const drawings = await drawingsFromContour(legacy.polygon, legacy.wallIndices, legacy.params)
    return drawings.lamellaLayout
  } catch (error) {
    console.error('[generateLamellaLayoutSvg]', error)
    return null
  }
}

export interface OfferDrawings {
  topPlan: string | null
  lamellaLayout: string | null
}

export async function generateOfferDrawings(offer: Offer): Promise<OfferDrawings> {
  return {
    topPlan: await generateTopPlanSvg(offer),
    lamellaLayout: await generateLamellaLayoutSvg(offer),
  }
}
