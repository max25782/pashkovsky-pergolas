import { worldToScreen } from '../geometry/coords'
import type { Point, Viewport } from '../geometry/types'

interface StartPointProps {
  point: Point
  viewport: Viewport
  /** true, когда резиновая линия сейчас прилипла к этой точке (магнит замыкания). */
  highlighted?: boolean
  /**
   * Текст подсказки «клик замкнёт контур» — показывается только пока
   * highlighted===true, нативным SVG <title> (браузерный тултип по hover,
   * без своего компонента и стилей). undefined/highlighted=false — без тултипа.
   */
  tooltip?: string
}

/** Тупой слой: только рисует то, что передано. Никаких вычислений геометрии здесь. */
export function StartPoint({ point, viewport, highlighted = false, tooltip }: StartPointProps) {
  const screen = worldToScreen(point, viewport)
  return (
    <g>
      {highlighted && (
        <circle cx={screen.x} cy={screen.y} r={11} fill="none" stroke="#22c55e" strokeWidth={2} opacity={0.6}>
          {tooltip && <title>{tooltip}</title>}
        </circle>
      )}
      <circle
        cx={screen.x}
        cy={screen.y}
        r={5}
        fill={highlighted ? '#22c55e' : '#3b82f6'}
        stroke={highlighted ? '#166534' : '#1e3a8a'}
        strokeWidth={1.5}
      >
        {highlighted && tooltip && <title>{tooltip}</title>}
      </circle>
    </g>
  )
}
