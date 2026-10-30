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

import { formatPurlinClearLabelMm, type Point2D } from '@pashkovsky/pergola-core'
import { worldToScreen, readableLabelAngleDeg } from './viewport'
import type { Viewport, Point } from './viewport'
import type { DimensionLineLayout } from './geometry/dimensionLayout'

function toPoint(p: Point2D): Point {
  return { x: p[0], y: p[1] }
}

export interface UniformLabelSummary {
  sectionClearMm: number
  sectionClearLabel?: string
  sectionCount: number
}

export interface DimensionChainSvgProps {
  layout: DimensionLineLayout
  viewport: Viewport
  /** Extension/measured-line colour override, e.g. to distinguish a "clear opening" chain from an axial one. Defaults to the neutral axial palette. */
  strokeColor?: string
  extensionColor?: string
  /** Label formatter — default rounds to integer mm. */
  formatLengthMm?: (mm: number) => string
  /** One label for the whole chain when every section clear matches (avoids overlapping text). */
  uniformLabelSummary?: UniformLabelSummary | null
  /** Alternate label offset on even/odd segments when sections differ. */
  staggerSegmentLabels?: boolean
  /** Screen px. The plan sheet passes a larger size so A4 print stays readable. */
  labelFontSize?: number
  /** Extra shift for the single summary label, away from the perimeter chain. */
  summaryDy?: number
  /** Screen-pixel shift applied to the summary anchor before rotation, so the label stays on the outer side of the chain. */
  summaryShift?: { dx: number; dy: number }
  /** Final screen center for each segment label. Skips the default offset when set. */
  segmentAnchors?: Array<{ x: number; y: number } | null>
  segmentIds?: string[]
  /** Screen center of the chain summary after clearance. */
  summaryAnchor?: { x: number; y: number } | null
}

export function DimensionChainSvg({
  layout,
  viewport,
  strokeColor = '#1f2937',
  extensionColor = '#9ca3af',
  formatLengthMm = formatPurlinClearLabelMm,
  uniformLabelSummary,
  staggerSegmentLabels = false,
  labelFontSize = 12,
  summaryDy = -10,
  summaryShift,
  segmentAnchors,
  segmentIds,
  summaryAnchor,
}: DimensionChainSvgProps) {
  const summaryCenter =
    uniformLabelSummary && layout.segments.length > 0
      ? (() => {
          const first = layout.segments[0].labelAnchor
          const last = layout.segments[layout.segments.length - 1].labelAnchor
          return { x: (first[0] + last[0]) / 2, y: (first[1] + last[1]) / 2 }
        })()
      : null

  return (
    <g>
      {layout.extensionLines.map((ext, i) => {
        const from = worldToScreen(toPoint(ext.from), viewport)
        const to = worldToScreen(toPoint(ext.to), viewport)
        return <line key={i} data-clearance-line={`${from.x},${from.y},${to.x},${to.y}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={extensionColor} strokeWidth={1} />
      })}

      {layout.segments.map((seg, i) => {
        const from = worldToScreen(toPoint(seg.fromOffsetPoint), viewport)
        const to = worldToScreen(toPoint(seg.toOffsetPoint), viewport)
        const base = worldToScreen(toPoint(seg.labelAnchor), viewport)
        const override = segmentAnchors?.[i]
        const anchor = override ?? base
        const angle = readableLabelAngleDeg(to.x - from.x, to.y - from.y)
        const labelDy = override ? 0 : staggerSegmentLabels ? (i % 2 === 0 ? -8 : -20) : -6
        const id = segmentIds?.[i]
        const lengthText = formatLengthMm(seg.lengthMm)
        const boxW = Math.max(labelFontSize, lengthText.length * labelFontSize * 0.62)
        const boxH = labelFontSize * 1.2
        return (
          <g key={i}>
            <line
              data-clearance-line={`${from.x},${from.y},${to.x},${to.y}`}
              data-clearance-owner={id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={strokeColor}
              strokeWidth={1}
              markerStart="url(#pergola-dim-arrow)"
              markerEnd="url(#pergola-dim-arrow)"
            />
            {!uniformLabelSummary && (
              <text
                data-label-id={id}
                data-label-box={`${anchor.x},${anchor.y + labelDy},${boxW},${boxH}`}
                data-label-font={labelFontSize}
                x={anchor.x}
                y={anchor.y}
                transform={`rotate(${angle}, ${anchor.x}, ${anchor.y}) translate(0, ${labelDy})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={labelFontSize}
                fontFamily="monospace"
                fill={strokeColor}
              >
                {lengthText}
              </text>
            )}
          </g>
        )
      })}
      {uniformLabelSummary && summaryCenter && layout.segments.length > 0 && (() => {
        const first = layout.segments[0]
        const from = worldToScreen(toPoint(first.fromOffsetPoint), viewport)
        const to = worldToScreen(toPoint(first.toOffsetPoint), viewport)
        const anchor = summaryAnchor ?? worldToScreen(summaryCenter, viewport)
        const shifted = summaryAnchor
          ? { x: summaryAnchor.x, y: summaryAnchor.y }
          : {
              x: anchor.x + (summaryShift?.dx ?? 0),
              y: anchor.y + (summaryShift?.dy ?? 0),
            }
        const angle = readableLabelAngleDeg(to.x - from.x, to.y - from.y)
        const { sectionClearMm, sectionClearLabel, sectionCount } = uniformLabelSummary
        const summaryText = `${sectionCount}×${sectionClearLabel ?? formatPurlinClearLabelMm(sectionClearMm)}`
        const summaryFont = labelFontSize + 1
        return (
          <text
            data-label-id="clear-summary"
            data-label-box={`${shifted.x},${shifted.y + summaryDy},${Math.max(summaryFont, summaryText.length * summaryFont * 0.62)},${summaryFont * 1.2}`}
            data-label-font={summaryFont}
            x={shifted.x}
            y={shifted.y}
            transform={`rotate(${angle}, ${shifted.x}, ${shifted.y}) translate(0, ${summaryAnchor ? 0 : summaryDy})`}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={labelFontSize + 1}
            fontFamily="monospace"
            fontWeight={600}
            fill={strokeColor}
          >
            {sectionCount}×{sectionClearLabel ?? formatPurlinClearLabelMm(sectionClearMm)}
          </text>
        )
      })()}
    </g>
  )
}
