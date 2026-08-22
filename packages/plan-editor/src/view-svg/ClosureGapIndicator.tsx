import { worldToScreen } from '../geometry/coords'
import type { Point, Viewport } from '../geometry/types'

interface ClosureGapIndicatorProps {
  /** Конец последней зафиксированной стороны (мм, мир) — where контур на самом деле кончился. */
  lastPoint: Point
  /** Стартовая вершина контура (мм, мир) — куда он должен был вернуться. */
  startPoint: Point
  /** closureGap(fixedEdges).distMm — считается снаружи, geometry/closure.ts. */
  gapDistMm: number
  viewport: Viewport
}

const GAP_COLOR = '#f87171'
/** Ниже этого — невязка это шум округления/float, а не реальная ошибка замера. Не показываем. */
const GAP_DISPLAY_THRESHOLD_MM = 5

/**
 * Тупой слой: рисует правду, которую уже посчитал geometry/closure.ts.
 * Ничего не прячет и не автоисправляет — пунктир + число мм, красным.
 */
export function ClosureGapIndicator({ lastPoint, startPoint, gapDistMm, viewport }: ClosureGapIndicatorProps) {
  if (gapDistMm <= GAP_DISPLAY_THRESHOLD_MM) return null

  const from = worldToScreen(lastPoint, viewport)
  const to = worldToScreen(startPoint, viewport)
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2

  return (
    <g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={GAP_COLOR} strokeWidth={2} strokeDasharray="6 5" />
      <text
        x={midX}
        y={midY - 10}
        fill={GAP_COLOR}
        fontSize={12}
        fontFamily="monospace"
        fontWeight="bold"
        textAnchor="middle"
        style={{ userSelect: 'none' }}
      >
        {`не замкнуто: ${Math.round(gapDistMm)} мм`}
      </text>
    </g>
  )
}
