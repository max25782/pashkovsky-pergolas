import { worldToScreen } from '../geometry/coords'
import type { FixedEdge, Viewport } from '../geometry/types'
import { readableLabelAngleDeg } from './textAngle'

interface FixedEdgesProps {
  edges: FixedEdge[]
  viewport: Viewport
  /**
   * Клик по уже зафиксированной стороне — вход в A2 (правка длины/угла).
   * undefined, когда рисование заморожено (canDraw===false в PlanCanvas) —
   * тогда сторона просто не кликабельна (курсор остаётся default), а не
   * "клик, который ничего не делает" — так пользователю сразу видно состояние.
   */
  onEdgeClick?: (id: string) => void
  /**
   * Наведение мышью на сторону — независимо от canDraw/onEdgeClick, это
   * только подсветка для синхронизации с панелью «Изменить размеры»
   * (SizesPanel), не режим ввода. undefined-safe: если не передан, просто
   * не подсвечиваем и не сообщаем наружу.
   */
  onEdgeHover?: (id: string | null) => void
  /** Текущая подсвеченная сторона (наведение либо на канвасе, либо в панели размеров). */
  hoveredEdgeId?: string | null
  /** id стороны из lastAdjustResult.worstEdgeIndex — подсветка оранжевым. */
  worstEdgeId?: string | null
  /** id сторон из lastAdjustResult.ambiguousCandidates — подсветка жёлтым (обе/все, различить нельзя). */
  ambiguousEdgeIds?: string[]
}

const EDGE_COLOR = '#e2e8f0'
const WORST_EDGE_COLOR = '#f97316'
const AMBIGUOUS_EDGE_COLOR = '#eab308'
const LABEL_OFFSET_PX = 8
/** Прозрачная "толстая" линия под видимой — увеличивает область клика/наведения без изменения вида. */
const HIT_AREA_STROKE_WIDTH = 14
const EDGE_STROKE_WIDTH = 2.5
/** Наведение — независимо от worst/ambiguous цвета — просто утолщает видимую линию, чтобы подсветка читалась даже на уже цветной (оранжевой/жёлтой) стороне. */
const EDGE_STROKE_WIDTH_HOVERED = 4.5
/**
 * Пристенная сторона (attachedToWall) — толще и штрихом, чтобы отличаться
 * от свободной стороны без открытия панели «Изменить размеры» (промпт
 * «крепление к стене»: "На плане пристенную сторону рисовать иначе"). Цвет
 * не трогаем — worst/ambiguous/hover продолжают действовать поверх штриха.
 */
const WALL_EDGE_STROKE_WIDTH = 5
const WALL_EDGE_DASH = '10 6'

/**
 * Тупой слой: только рисует то, что уже посчитано в model/geometry.
 * Вершины рисуются в `to` каждой стороны — `from` первой стороны совпадает
 * со startPoint, который уже рисует <StartPoint/>, поэтому не дублируем точку там.
 */
export function FixedEdges({
  edges,
  viewport,
  onEdgeClick,
  onEdgeHover,
  hoveredEdgeId,
  worstEdgeId,
  ambiguousEdgeIds,
}: FixedEdgesProps) {
  return (
    <g>
      {edges.map((edge) => {
        const from = worldToScreen(edge.from, viewport)
        const to = worldToScreen(edge.to, viewport)
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2
        // Угол берём из ЭКРАННЫХ дельт, не из мирового edge.angleDeg — см.
        // readableLabelAngleDeg: так подпись никогда не оказывается зеркальной
        // из-за Y-flip, независимо от направления стороны в мире.
        const labelAngle = readableLabelAngleDeg(to.x - from.x, to.y - from.y)

        const isAmbiguous = ambiguousEdgeIds?.includes(edge.id) === true
        const isWorst = !isAmbiguous && worstEdgeId === edge.id
        const isHovered = hoveredEdgeId === edge.id
        const isWall = edge.attachedToWall === true
        const color = isWorst ? WORST_EDGE_COLOR : isAmbiguous ? AMBIGUOUS_EDGE_COLOR : EDGE_COLOR
        const strokeWidth = isHovered
          ? EDGE_STROKE_WIDTH_HOVERED
          : isWall
            ? WALL_EDGE_STROKE_WIDTH
            : EDGE_STROKE_WIDTH

        return (
          <g key={edge.id}>
            {/*
              Хит-área рендерится ВСЕГДА, а не только при onEdgeClick — наведение
              (для синхронизации с панелью «Изменить размеры») не зависит от того,
              разрешён ли сейчас клик-вход в A2 (canDraw/onEdgeClick может быть
              undefined после замыкания контура, но подсветка должна работать и там).
              onClick вешается ТОЛЬКО когда onEdgeClick передан — иначе курсор
              остаётся default и клик не делает ничего, как и раньше.
            */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="transparent"
              strokeWidth={HIT_AREA_STROKE_WIDTH}
              style={{ cursor: onEdgeClick ? 'pointer' : 'default' }}
              onClick={
                onEdgeClick
                  ? (e) => {
                      // Обязательный stopPropagation: без него клик всплывёт до
                      // onClick корневого <svg> (usePlanEditorInput.onClick) и
                      // зафиксирует лишнюю резиновую сторону поверх открывшегося
                      // редактора — тот самый конфликт всплытия из части A2.
                      e.stopPropagation()
                      onEdgeClick(edge.id)
                    }
                  : undefined
              }
              onMouseEnter={() => onEdgeHover?.(edge.id)}
              onMouseLeave={() => onEdgeHover?.(null)}
            />
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={isWall ? WALL_EDGE_DASH : undefined}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
            <circle cx={to.x} cy={to.y} r={4} fill={color} style={{ pointerEvents: 'none' }} />
            <text
              x={midX}
              y={midY}
              fill={color}
              fontSize={12}
              fontFamily="monospace"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${labelAngle}, ${midX}, ${midY}) translate(0, -${LABEL_OFFSET_PX})`}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {Math.round(edge.lengthMm)} мм
            </text>
          </g>
        )
      })}
    </g>
  )
}
