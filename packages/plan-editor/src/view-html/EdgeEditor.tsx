'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { usePlanEditorStore, MIN_EDGE_LENGTH_MM } from '../model/store'
import { worldToScreen } from '../geometry/coords'
import { mmToLengthUnit, lengthUnitToMm } from '../input/dynamicInputBuffer'

export interface EdgeEditorLabels {
  lengthLabel: string
  angleLabel: string
}

interface EdgeEditorProps {
  labels: EdgeEditorLabels
}

/**
 * A2 — правка уже зафиксированной стороны. НАСТОЯЩИЙ HTML-инпут с реальным
 * DOM-фокусом (в отличие от A1 — см. view-svg/DynamicInputBadge.tsx). Рендерится
 * как оверлей поверх канваса: позиционируется через worldToScreen относительно
 * контейнера-обёртки (см. PlanEditor.tsx — контейнер обязан быть
 * position:relative, иначе позиция уедет на величину сдвига страницы).
 *
 * Три конфликта реальной среды (см. промпт шага 3C, часть A2), все три учтены:
 *   1. Всплытие клика — stopPropagation на onPointerDown/onClick контейнера
 *      оверлея, иначе клик всплывёт до onClick SVG (usePlanEditorInput.onClick)
 *      и зафиксирует лишнюю сторону поверх открытого редактора.
 *   2. Клавиатура — этот компонент рендерится ТОЛЬКО когда editingEdgeId!==null,
 *      что уже означает canDraw===false в usePlanEditorInput — обработчик A1
 *      там инертен целиком (единый предикат canDraw), поэтому Shift/цифры в
 *      этих полях не утекают в буфер A1. Никакой дополнительной синхронизации
 *      здесь не нужно — она уже сделана на стороне input-слоя.
 *   3. Протухший курсор — closeEditor() (store) сам обнуляет draftEdge, так что
 *      резиновая линия не прыгнет со старой позиции после закрытия; этот
 *      компонент ни во что здесь не вмешивается.
 */
export function EdgeEditor({ labels }: EdgeEditorProps) {
  const editingEdgeId = usePlanEditorStore((s) => s.editingEdgeId)
  const fixedEdges = usePlanEditorStore((s) => s.fixedEdges)
  const viewport = usePlanEditorStore((s) => s.viewport)
  const inputUnit = usePlanEditorStore((s) => s.inputUnit)
  const updateEdgeLength = usePlanEditorStore((s) => s.updateEdgeLength)
  const updateEdgeAngle = usePlanEditorStore((s) => s.updateEdgeAngle)
  const closeEditor = usePlanEditorStore((s) => s.closeEditor)

  const edge = editingEdgeId ? fixedEdges.find((e) => e.id === editingEdgeId) ?? null : null

  const [lengthText, setLengthText] = useState('')
  const [angleText, setAngleText] = useState('')
  const lengthInputRef = useRef<HTMLInputElement>(null)

  // Предзаполнение — при каждом открытии другой стороны (editingEdgeId сменился),
  // не на каждый ре-рендер: иначе набор в поле сбрасывался бы собственным эхом.
  useEffect(() => {
    if (!edge) return
    setLengthText(formatNumber(mmToLengthUnit(edge.lengthMm, inputUnit)))
    setAngleText(formatNumber(edge.angleDeg))
    // Фокус в длину — «фокус в длине» по спецификации A2.
    requestAnimationFrame(() => lengthInputRef.current?.focus())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge?.id])

  if (!edge) return null

  function apply() {
    if (!edge) return
    const lengthMm = lengthUnitToMm(parseFloat(lengthText.replace(',', '.')), inputUnit)
    const angleDeg = parseFloat(angleText.replace(',', '.'))
    // >= MIN_EDGE_LENGTH_MM, не просто > 0 — тот же порог, что updateEdgeLength
    // (model/store.ts) сам применяет как защиту от вырожденной/почти-дубль
    // вершины: держим UI-проверку в согласии с фактическим порогом, а не
    // молча пропускаем значение, которое store всё равно отбросит.
    if (Number.isFinite(lengthMm) && lengthMm >= MIN_EDGE_LENGTH_MM) updateEdgeLength(edge.id, lengthMm)
    if (Number.isFinite(angleDeg)) updateEdgeAngle(edge.id, angleDeg)
    closeEditor()
  }

  const mid = worldToScreen(
    { x: (edge.from.x + edge.to.x) / 2, y: (edge.from.y + edge.to.y) / 2 },
    viewport,
  )

  return (
    <div
      // Конфликт 1: без stopPropagation здесь клик по инпуту всплывает до
      // корневого <svg onClick> и создаёт лишнюю сторону — см. класс-комментарий.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: mid.x,
        top: mid.y,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid #334155',
        borderRadius: 8,
        padding: '8px 10px',
        zIndex: 30,
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          apply()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          closeEditor()
        } else if (e.key === 'Tab') {
          // Tab внутри редактора листает поля обычным DOM-фокусом (браузерное
          // поведение), явный preventDefault не нужен — здесь ДРУГОЙ Tab, не
          // тот, что переключает length/angle в A1.
        }
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: '#94a3b8' }}>
        {labels.lengthLabel} ({inputUnit})
        <input
          ref={lengthInputRef}
          type="text"
          inputMode="decimal"
          value={lengthText}
          onChange={(e) => setLengthText(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 11, color: '#94a3b8' }}>
        {labels.angleLabel} (°)
        <input
          type="text"
          inputMode="decimal"
          value={angleText}
          onChange={(e) => setAngleText(e.target.value)}
          style={inputStyle}
        />
      </label>
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: 72,
  background: '#0f172a',
  border: '1px solid #475569',
  borderRadius: 4,
  color: '#e2e8f0',
  fontFamily: 'monospace',
  fontSize: 13,
  padding: '4px 6px',
}

function formatNumber(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}
