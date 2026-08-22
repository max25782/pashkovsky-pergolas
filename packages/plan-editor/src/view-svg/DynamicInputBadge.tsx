import { worldToScreen, distance } from '../geometry/coords'
import { normalizeAngle } from '../geometry/snap'
import { mmToLengthUnit } from '../input/dynamicInputBuffer'
import type { DynamicInputBufferState } from '../input/dynamicInputBuffer'
import type { DraftEdge, LengthUnit, Viewport } from '../geometry/types'

interface DynamicInputBadgeProps {
  edge: DraftEdge
  buffer: DynamicInputBufferState
  unit: LengthUnit
  viewport: Viewport
}

const OFFSET_PX = 18
const LOCKED_COLOR = '#f59e0b'
const LIVE_COLOR = '#e2e8f0'
const BG_COLOR = 'rgba(15, 23, 42, 0.85)'

/**
 * Бейдж динамического ввода A1 (AutoCAD dynamic input) у конца резиновой
 * линии. Тупой SVG-слой — никакого DOM-фокуса, никакого <input>: буфер
 * печатается перехватом клавиш на window (см. usePlanEditorInput), это
 * обычный <text>, ничем не отличающийся по кликабельности от остальной
 * геометрии. Оранжевая рамка/цвет — единственный визуальный признак
 * "защёлкнуто" (мышь больше не управляет этим измерением).
 *
 * Смещение от курсора (OFFSET_PX), а не поверх него — иначе бейдж сам
 * закрывает точку, за которой пользователь визуально следит.
 */
export function DynamicInputBadge({ edge, buffer, unit, viewport }: DynamicInputBadgeProps) {
  const to = worldToScreen(edge.to, viewport)

  const lengthLocked = buffer.lengthText !== ''
  const angleLocked = buffer.angleText !== ''

  const liveLengthMm = distance(edge.from, edge.to)
  const liveAngleDeg = normalizeAngle(edge.dir.angleDeg)

  const lengthText = lengthLocked
    ? buffer.lengthText
    : formatNumber(mmToLengthUnit(liveLengthMm, unit))
  const angleText = angleLocked ? buffer.angleText : formatNumber(liveAngleDeg)

  const x = to.x + OFFSET_PX
  const y = to.y + OFFSET_PX

  return (
    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <rect x={x - 6} y={y - 14} width={110} height={34} rx={4} fill={BG_COLOR} />
      <text
        x={x}
        y={y}
        fontSize={13}
        fontFamily="monospace"
        fill={lengthLocked ? LOCKED_COLOR : LIVE_COLOR}
        fontWeight={lengthLocked ? 700 : 400}
      >
        {lengthText} {unit}
        {buffer.activeField === 'length' && '▏'}
      </text>
      <text
        x={x}
        y={y + 16}
        fontSize={13}
        fontFamily="monospace"
        fill={angleLocked ? LOCKED_COLOR : LIVE_COLOR}
        fontWeight={angleLocked ? 700 : 400}
      >
        {angleText}°{buffer.activeField === 'angle' && '▏'}
      </text>
    </g>
  )
}

function formatNumber(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}
