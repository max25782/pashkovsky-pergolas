'use client'

import type { PergolaPlan } from '@/types/offer'
import { polygonAreaM2 } from '@pashkovsky/pergola-core'
import { roundBillableAreaSqm } from '@/lib/pergolas/pergola-area-sqm'

interface PergolaDrawingSummaryProps {
  plan: PergolaPlan
  noDrawingLabel: string
  areaLabel: (area: string) => string
  edgesLabel: (edges: string) => string
}

export function PergolaDrawingSummary({
  plan,
  noDrawingLabel,
  areaLabel,
  edgesLabel,
}: PergolaDrawingSummaryProps) {
  const polygon = plan.polygon
  if (!polygon || polygon.length < 3) {
    return <p className="text-sm text-white/60">{noDrawingLabel}</p>
  }

  const areaM2 = roundBillableAreaSqm(polygonAreaM2(polygon))
  const edges = polygon
    .map((point, edgeIndex) => {
      const next = polygon[(edgeIndex + 1) % polygon.length]
      return (Math.hypot(next.x - point.x, next.y - point.y) / 1000).toFixed(2)
    })
    .join(' · ')

  const xs = polygon.map((p) => p.x)
  const ys = polygon.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const pad = 40
  const width = Math.max(maxX - minX, 1) + pad * 2
  const height = Math.max(maxY - minY, 1) + pad * 2
  const screen = (point: { x: number; y: number }) => ({
    x: point.x - minX + pad,
    y: maxY - point.y + pad,
  })
  const points = polygon
    .map((point) => {
      const mapped = screen(point)
      return `${mapped.x.toFixed(1)},${mapped.y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="space-y-2 rounded-lg border border-white/15 bg-white/5 p-3">
      <svg
        viewBox={`0 0 ${width.toFixed(1)} ${height.toFixed(1)}`}
        className="h-36 w-full rounded bg-white"
        aria-hidden
      >
        <polygon points={points} fill="#f8fafc" stroke="#0f172a" strokeWidth="8" />
      </svg>
      <p className="text-sm text-white/80">{areaLabel(areaM2.toFixed(2))}</p>
      <p className="text-xs text-white/60">{edgesLabel(edges)}</p>
    </div>
  )
}
