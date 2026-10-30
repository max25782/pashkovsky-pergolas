'use client'

import { useMemo } from 'react'
import type { PlanEditorOverlayModel, Point2D } from '@pashkovsky/pergola-core'
import { contourEdgeOutward, matchContourEdgeIndex } from '@pashkovsky/pergola-core'
import type { Viewport } from './viewport'
import { worldToScreen } from './viewport'
import { InteriorAngleSvg } from './InteriorAngleSvg'
import { DimensionChainSvg } from './DimensionChainSvg'
import { buildDimensionLineLayout, outwardNormal } from './geometry/dimensionLayout'

const PERIMETER_OFFSET_MM = 500
const PURLIN_CLEAR_OFFSET_MM = 320

export interface PlanEditorCanvasOverlayProps {
  model: PlanEditorOverlayModel
  contour: Array<{ x: number; y: number }>
  viewport: Viewport
  selectedDividerId?: string | null
  onSelectDivider?: (id: string | null) => void
}

export function PlanEditorCanvasOverlay({
  model,
  contour,
  viewport,
  selectedDividerId,
  onSelectDivider,
}: PlanEditorCanvasOverlayProps) {
  const contour2d = useMemo(
    () => contour.map((p): [number, number] => [p.x, p.y]),
    [contour],
  )

  const perimeterLayouts = useMemo(
    () =>
      model.dimensionModel.perimeterChains.map((chain, i) => {
        const side = model.geometricSides[i]
        const edgeIndex = matchContourEdgeIndex(side, contour2d)
        const outward = edgeIndex >= 0
          ? contourEdgeOutward(contour2d, edgeIndex)
          : outwardNormal(side.start, side.end, model.centroid)
        return buildDimensionLineLayout(chain, outward, PERIMETER_OFFSET_MM)
      }),
    [model, contour2d],
  )

  const lamellaDir = useMemo(() => {
    const θ = (model.lamellaDirectionDeg * Math.PI) / 180
    return [Math.cos(θ), Math.sin(θ)] as [number, number]
  }, [model.lamellaDirectionDeg])

  const purlinClearLayout = useMemo(() => {
    const chain = model.dimensionModel.purlinClearChain
    if (!chain || chain.points.length < 2) return null
    const first = chain.points[0].point
    const last = chain.points[chain.points.length - 1].point
    const outward = outwardNormal(first, last, model.centroid)
    return buildDimensionLineLayout(chain, outward, PURLIN_CLEAR_OFFSET_MM)
  }, [model.dimensionModel.purlinClearChain, model.centroid])

  return (
    <g pointerEvents="none">
      <defs>
        <marker id="pergola-dim-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L9,5 L0,9 Z" fill="#1f2937" />
        </marker>
        <marker id="pergola-lamella-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,1 L9,5 L0,9 Z" fill="#2563eb" />
        </marker>
      </defs>

      {perimeterLayouts.map((layout) => (
        <DimensionChainSvg key={layout.edgeIndex} layout={layout} viewport={viewport} />
      ))}

      {purlinClearLayout && (
        <DimensionChainSvg
          layout={purlinClearLayout}
          viewport={viewport}
          strokeColor="#0f766e"
          extensionColor="#5eead4"
          uniformLabelSummary={model.dimensionModel.purlinClearDisplaySummary}
          staggerSegmentLabels={!model.dimensionModel.purlinClearDisplaySummary}
        />
      )}

      {model.dimensionModel.angleClosureWarning && (
        <text x={16} y={22} fill="#f87171" fontSize={13} fontFamily="sans-serif">
          {model.dimensionModel.angleClosureWarning}
        </text>
      )}

      <InteriorAngleSvg
        contour={contour2d}
        angles={model.dimensionModel.vertexAngles}
        viewport={viewport}
        centroid={model.centroid}
        obstacles={[
          ...perimeterLayouts.flatMap((layout) => [
            ...layout.segments.map((segment) => [segment.fromOffsetPoint, segment.toOffsetPoint] as [Point2D, Point2D]),
            ...layout.extensionLines.map((line) => [line.from, line.to] as [Point2D, Point2D]),
          ]),
          ...(purlinClearLayout
            ? [
                ...purlinClearLayout.segments.map((segment) => [segment.fromOffsetPoint, segment.toOffsetPoint] as [Point2D, Point2D]),
                ...purlinClearLayout.extensionLines.map((line) => [line.from, line.to] as [Point2D, Point2D]),
              ]
            : []),
          ...contour2d.map((point, index) => [point, contour2d[(index + 1) % contour2d.length]] as [Point2D, Point2D]),
        ]}
      />

      {model.dividerLines.map((line, lineIndex) => {
        const from = worldToScreen({ x: line.start[0], y: line.start[1] }, viewport)
        const to = worldToScreen({ x: line.end[0], y: line.end[1] }, viewport)
        const selected = selectedDividerId === line.dividerId
        const stroke = selected ? '#2563eb' : line.isWingShelfSpan ? '#f97316' : '#fb923c'
        const dx = line.end[0] - line.start[0]
        const dy = line.end[1] - line.start[1]
        const lineLen = Math.hypot(dx, dy)
        const along =
          line.isWingShelfSpan && lineLen > 1
            ? [dx / lineLen, dy / lineLen]
            : lamellaDir
        const midX = (line.start[0] + line.end[0]) / 2
        const midY = (line.start[1] + line.end[1]) / 2
        const arrowHalf = Math.min(400, lineLen * 0.2)
        const arrowStart = worldToScreen(
          { x: midX - along[0] * arrowHalf, y: midY - along[1] * arrowHalf },
          viewport,
        )
        const arrowEnd = worldToScreen(
          { x: midX + along[0] * arrowHalf, y: midY + along[1] * arrowHalf },
          viewport,
        )
        return (
          <g key={`${line.dividerId}:${lineIndex}`} pointerEvents="all" style={{ cursor: onSelectDivider ? 'pointer' : 'default' }}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="transparent"
              strokeWidth={14}
              onClick={(e) => {
                e.stopPropagation()
                onSelectDivider?.(line.dividerId)
              }}
            />
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={stroke} strokeWidth={selected ? 4 : 2.5} />
            {line.isWingShelfSpan && lineLen > 1 && (
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 10}
                textAnchor="middle"
                fontSize={12}
                fontFamily="monospace"
                fill="#c2410c"
              >
                {Math.round(line.lengthMm ?? lineLen)}
              </text>
            )}
            <line
              x1={arrowStart.x}
              y1={arrowStart.y}
              x2={arrowEnd.x}
              y2={arrowEnd.y}
              stroke="#2563eb"
              strokeWidth={1.5}
              markerEnd="url(#pergola-lamella-arrow)"
            />
          </g>
        )
      })}
    </g>
  )
}
