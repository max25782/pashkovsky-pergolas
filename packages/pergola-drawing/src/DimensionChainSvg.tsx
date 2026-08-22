'use client'

/**
 * Shared SVG renderer for ONE dimension chain layout (extension lines + a
 * measured segment with an arrow-tipped line and a length label per
 * segment) — used by every drawing sheet that needs a dimension chain
 * (TopPlanSheet's axial по-центрам chain, LamellaLayoutSheet's pitch chain,
 * …). Pulled out of TopPlanSheet.tsx so the two sheets share ONE rendering
 * implementation instead of two copies drifting apart (DRY — see project
 * rules).
 */

import type { Point2D } from '@pashkovsky/pergola-core'
import { worldToScreen, readableLabelAngleDeg } from '@pashkovsky/plan-editor'
import type { Viewport, Point } from '@pashkovsky/plan-editor'
import type { DimensionLineLayout } from './geometry/dimensionLayout'

function toPoint(p: Point2D): Point {
  return { x: p[0], y: p[1] }
}

export interface DimensionChainSvgProps {
  layout: DimensionLineLayout
  viewport: Viewport
  /** Extension/measured-line colour override, e.g. to distinguish a "clear opening" chain from an axial one. Defaults to the neutral axial palette. */
  strokeColor?: string
  extensionColor?: string
}

export function DimensionChainSvg({ layout, viewport, strokeColor = '#1f2937', extensionColor = '#9ca3af' }: DimensionChainSvgProps) {
  return (
    <g>
      {layout.extensionLines.map((ext, i) => {
        const from = worldToScreen(toPoint(ext.from), viewport)
        const to = worldToScreen(toPoint(ext.to), viewport)
        return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={extensionColor} strokeWidth={1} />
      })}

      {layout.segments.map((seg, i) => {
        const from = worldToScreen(toPoint(seg.fromOffsetPoint), viewport)
        const to = worldToScreen(toPoint(seg.toOffsetPoint), viewport)
        const anchor = worldToScreen(toPoint(seg.labelAnchor), viewport)
        const angle = readableLabelAngleDeg(to.x - from.x, to.y - from.y)
        return (
          <g key={i}>
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={strokeColor}
              strokeWidth={1}
              markerStart="url(#pergola-dim-arrow)"
              markerEnd="url(#pergola-dim-arrow)"
            />
            <text
              x={anchor.x}
              y={anchor.y}
              transform={`rotate(${angle}, ${anchor.x}, ${anchor.y}) translate(0, -6)`}
              textAnchor="middle"
              fontSize={12}
              fontFamily="monospace"
              fill={strokeColor}
            >
              {Math.round(seg.lengthMm)}
            </text>
          </g>
        )
      })}
    </g>
  )
}
