import { worldToScreen } from '../geometry/coords'
import type { DraftEdge, Viewport } from '../geometry/types'

interface RubberEdgeProps {
  edge: DraftEdge
  viewport: Viewport
}

const SNAPPED_COLOR = '#22c55e'
const FREE_COLOR = '#9ca3af'

/**
 * Тупой слой: только рисует edge.dir, которое уже посчитано в geometry/.
 * snapped=true → зелёная линия + бейдж с углом привязки.
 * snapped=false → нейтральный серый, без бейджа.
 */
export function RubberEdge({ edge, viewport }: RubberEdgeProps) {
  const from = worldToScreen(edge.from, viewport)
  const to = worldToScreen(edge.to, viewport)
  const color = edge.dir.snapped ? SNAPPED_COLOR : FREE_COLOR

  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  return (
    <g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={color} strokeWidth={2} strokeLinecap="round" />
      {edge.dir.snapped && edge.dir.snapAngle !== null && (
        <text
          x={midX + 8}
          y={midY - 8}
          fill={color}
          fontSize={12}
          fontFamily="monospace"
          style={{ userSelect: 'none' }}
        >
          {Math.round(edge.dir.snapAngle)}°
        </text>
      )}
    </g>
  )
}
