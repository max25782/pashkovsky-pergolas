import type { AxialDimensionChain } from '@pashkovsky/pergola-core'
import type { Point2D } from '@pashkovsky/pergola-core'

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
  return Math.sqrt(a[0] * a[0] + a[1] * a[1])
}
function midpoint(a: Point2D, b: Point2D): Point2D {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

/**
 * Unit vector perpendicular to edge (A→B), pointing AWAY from `centroid` —
 * i.e. outward from the polygon. Used to decide which side of an edge the
 * dimension line is pulled out to (see prompt "размерная линия... выносится
 * за контур" — a dimension line must never sit ON TOP of the polygon/beam
 * it measures).
 */
export function outwardNormal(edgeStart: Point2D, edgeEnd: Point2D, centroid: Point2D): Point2D {
  const edgeVec = sub(edgeEnd, edgeStart)
  const edgeLen = len(edgeVec)
  const dir: Point2D = edgeLen > 1e-9 ? scale(edgeVec, 1 / edgeLen) : [1, 0]
  const candidate: Point2D = [-dir[1], dir[0]]
  const mid = midpoint(edgeStart, edgeEnd)
  const towardCentroid = dot(sub(centroid, mid), candidate)
  // candidate already points away from centroid if this dot product is negative
  return towardCentroid > 0 ? scale(candidate, -1) : candidate
}

export interface DimensionExtensionLine {
  /** On the piece/chain point itself. */
  from: Point2D
  /** Out on the offset dimension line. */
  to: Point2D
}

export interface DimensionSegmentLayout {
  /** Original chain points this segment spans (world/plan mm). */
  fromPoint: Point2D
  toPoint: Point2D
  /** Same two points, projected onto the offset dimension line — where the arrows/ticks actually sit. */
  fromOffsetPoint: Point2D
  toOffsetPoint: Point2D
  lengthMm: number
  /** Midpoint of the offset segment — where the length label is anchored. */
  labelAnchor: Point2D
}

export interface DimensionLineLayout {
  edgeIndex: number
  /** One extension line per chain point (corner + every intermediate post). */
  extensionLines: DimensionExtensionLine[]
  /** One entry per consecutive pair of chain points — same order/count as chain.segmentsMm. */
  segments: DimensionSegmentLayout[]
}

/**
 * Turn one axial dimension chain (pure post/corner data from pergola-core,
 * see dimensionChains.ts) into concrete 2D geometry for an SVG dimension
 * line: an extension line from every chain point out to a parallel offset
 * line, and one measured segment between every consecutive pair of points
 * on that offset line.
 *
 * Pure geometry, no SVG/pixels — see project rule "чертёж: геометрия
 * размеров тестируется без пикселей".
 */
export function buildDimensionLineLayout(
  chain: AxialDimensionChain,
  outward: Point2D,
  offsetMm: number,
): DimensionLineLayout {
  const offsetVec = scale(outward, offsetMm)

  const extensionLines: DimensionExtensionLine[] = chain.points.map((p) => ({
    from: p.point,
    to: add(p.point, offsetVec),
  }))

  const segments: DimensionSegmentLayout[] = chain.points.slice(1).map((p, i) => {
    const prev = chain.points[i]
    const fromOffsetPoint = add(prev.point, offsetVec)
    const toOffsetPoint = add(p.point, offsetVec)
    return {
      fromPoint: prev.point,
      toPoint: p.point,
      fromOffsetPoint,
      toOffsetPoint,
      lengthMm: p.distanceFromStartMm - prev.distanceFromStartMm,
      labelAnchor: midpoint(fromOffsetPoint, toOffsetPoint),
    }
  })

  return { edgeIndex: chain.edgeIndex, extensionLines, segments }
}
