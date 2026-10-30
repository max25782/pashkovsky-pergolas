'use client'

import type { Point2D, VertexInteriorAngle } from '@pashkovsky/pergola-core'
import { worldToScreen } from './viewport'
import type { Viewport, Point } from './viewport'
import { angleLabelClearPoint, angleLabelWorldPoint } from './planDimensionsSvg'

function toPoint(p: Point2D): Point {
  return { x: p[0], y: p[1] }
}

function sub(a: Point2D, b: Point2D): Point2D {
  return [a[0] - b[0], a[1] - b[1]]
}
function unit(a: Point2D): Point2D {
  const l = Math.hypot(a[0], a[1])
  return l > 1e-9 ? [a[0] / l, a[1] / l] : [1, 0]
}
function add(a: Point2D, b: Point2D): Point2D {
  return [a[0] + b[0], a[1] + b[1]]
}
function scale(a: Point2D, s: number): Point2D {
  return [a[0] * s, a[1] * s]
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

export interface InteriorAngleSvgProps {
  contour: Point2D[]
  angles: VertexInteriorAngle[]
  viewport: Viewport
  /** Pulls the label inside the plan so it is not cut by the sheet edge. */
  centroid?: Point2D
  /** Segments the label must not sit on: dimension lines and beam edges. */
  obstacles?: Array<[Point2D, Point2D]>
  labelOffsetMm?: number
  arcRadiusMm?: number
  /** Screen center after clearance. Keyed by vertex index. */
  labelCenters?: ReadonlyMap<number, { x: number; y: number }>
}

export function InteriorAngleSvg({
  contour,
  angles,
  viewport,
  centroid,
  obstacles = [],
  labelOffsetMm = 450,
  arcRadiusMm = 320,
  labelCenters,
}: InteriorAngleSvgProps) {
  const n = contour.length
  return (
    <g>
      {angles.map((entry) => {
        const prev = contour[(entry.vertexIndex + n - 1) % n]
        const next = contour[(entry.vertexIndex + 1) % n]
        const v = entry.vertex
        const labelWorld = centroid
          ? (obstacles.length > 0
            ? angleLabelClearPoint(v, prev, next, centroid, obstacles)
            : angleLabelWorldPoint(v, prev, next, centroid, labelOffsetMm))
          : add(v, scale(unit([
              unit(sub(v, prev))[0] + unit(sub(next, v))[0],
              unit(sub(v, prev))[1] + unit(sub(next, v))[1],
            ]), labelOffsetMm))
        const labelScreen = labelCenters?.get(entry.vertexIndex) ?? worldToScreen(toPoint(labelWorld), viewport)
        const leaderFrom = worldToScreen(
          toPoint(add(v, scale(unit(sub(labelWorld, v)), arcRadiusMm + 40))),
          viewport,
        )

        const arcWorld = interiorArcPolyline(v, prev, next, arcRadiusMm, 16)
        const arcScreen = arcWorld
          .map((p) => worldToScreen(toPoint(p), viewport))
          .map((p) => `${p.x},${p.y}`)
          .join(' ')

        return (
          <g key={entry.vertexIndex}>
            <polyline points={arcScreen} fill="none" stroke="#4b5563" strokeWidth={1} />
            {Math.hypot(labelScreen.x - leaderFrom.x, labelScreen.y - leaderFrom.y) > 18 &&
              (labelCenters != null || !obstacles.some(([start, end]) => {
                const ax = labelWorld[0]
                const ay = labelWorld[1]
                const bx = v[0]
                const by = v[1]
                const dx = end[0] - start[0]
                const dy = end[1] - start[1]
                const denom = (bx - ax) * dy - (by - ay) * dx
                if (Math.abs(denom) < 1e-6) return false
                const t = ((start[0] - ax) * dy - (start[1] - ay) * dx) / denom
                const u = ((start[0] - ax) * (by - ay) - (start[1] - ay) * (bx - ax)) / denom
                return t > 0.05 && t < 0.95 && u >= 0 && u <= 1
              })) && (
              <line
                data-leader={`${leaderFrom.x},${leaderFrom.y},${labelScreen.x},${labelScreen.y}`}
                data-leader-for={`angle-${entry.vertexIndex}`}
                x1={leaderFrom.x}
                y1={leaderFrom.y}
                x2={labelScreen.x}
                y2={labelScreen.y}
                stroke="#9ca3af"
                strokeWidth={0.8}
              />
            )}
            <text
              data-label-id={`angle-${entry.vertexIndex}`}
              data-label-box={`${labelScreen.x},${labelScreen.y},${Math.max(14, `${entry.interiorAngleDeg.toFixed(1)}°`.length * 14 * 0.62)},${14 * 1.2}`}
              data-label-font={14}
              x={labelScreen.x}
              y={labelScreen.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={14}
              fontFamily="monospace"
              fill="#374151"
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {entry.interiorAngleDeg.toFixed(1)}°
            </text>
          </g>
        )
      })}
    </g>
  )
}
