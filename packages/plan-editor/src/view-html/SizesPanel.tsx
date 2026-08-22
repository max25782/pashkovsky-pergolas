'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { usePlanEditorStore, MIN_EDGE_LENGTH_MM } from '../model/store'
import { mmToLengthUnit, lengthUnitToMm } from '../input/dynamicInputBuffer'
import type { FixedEdge, LengthUnit } from '../geometry/types'

export interface SizesPanelLabels {
  title: string
  lengthHeader: string
  angleHeader: string
  /** Заголовок колонки чекбокса «к стене» (см. FixedEdge.attachedToWall). */
  wallHeader: string
  /** title атрибут чекбокса — озвучивает назначение при наведении. */
  wallCheckboxTitle: string
  emptyMessage: string
  closeButton: string
  /** "A → B" — обозначение стороны по буквам вершин, а не по индексу с нуля. */
  edgeLabel: (fromLetter: string, toLetter: string) => string
}

interface SizesPanelProps {
  isOpen: boolean
  onClose: () => void
  labels: SizesPanelLabels
}

const VERTEX_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** A, B, ..., Z, затем AA, AB... — с запасом на контуры длиннее 26 сторон. */
function vertexLetter(index: number): string {
  if (index < VERTEX_LETTERS.length) return VERTEX_LETTERS[index]
  const first = Math.floor(index / VERTEX_LETTERS.length) - 1
  const second = index % VERTEX_LETTERS.length
  return vertexLetter(first) + VERTEX_LETTERS[second]
}

/**
 * Часть 1 (доп. к A2) — явная, обнаруживаемая точка входа в правку размеров.
 * Клик по стороне на канвасе технически работает, но невидим: пользователь
 * должен догадаться, что сторону можно кликнуть. Эта панель — таблица со
 * всеми сторонами контура сразу, редактируемая построчно: типичный сценарий —
 * оператор с объекта вбивает 6 замеренных чисел подряд, это в разы быстрее
 * и точнее, чем клик-правка по одной стороне за раз (см. прежний EdgeEditor —
 * он остаётся как есть, для точечной правки одной конкретной стороны).
 *
 * hoveredEdgeId — двусторонняя подсветка со сторами на канвасе (FixedEdges):
 * наведение здесь подсвечивает сторону там, и наоборот (см. model/types.ts).
 */
export function SizesPanel({ isOpen, onClose, labels }: SizesPanelProps) {
  const fixedEdges = usePlanEditorStore((s) => s.fixedEdges)
  const inputUnit = usePlanEditorStore((s) => s.inputUnit)

  if (!isOpen) return null

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={panelStyle}
    >
      <div style={headerRowStyle}>
        <span style={{ fontWeight: 600 }}>
          {labels.title} ({inputUnit})
        </span>
        <button type="button" onClick={onClose} style={closeButtonStyle} aria-label={labels.closeButton}>
          ×
        </button>
      </div>

      {fixedEdges.length === 0 ? (
        <p style={emptyStyle}>{labels.emptyMessage}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          <div style={columnHeaderRowStyle}>
            <span style={designationColumnStyle} />
            <span style={{ flex: 1 }}>{labels.lengthHeader}</span>
            <span style={{ flex: 1 }}>{labels.angleHeader}</span>
            <span style={wallColumnStyle} title={labels.wallCheckboxTitle}>
              {labels.wallHeader}
            </span>
          </div>
          {fixedEdges.map((edge, i) => (
            <EdgeSizeRow
              key={edge.id}
              edge={edge}
              designation={labels.edgeLabel(vertexLetter(i), vertexLetter(i + 1))}
              inputUnit={inputUnit}
              wallCheckboxTitle={labels.wallCheckboxTitle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface EdgeSizeRowProps {
  edge: FixedEdge
  designation: string
  inputUnit: LengthUnit
  wallCheckboxTitle: string
}

function EdgeSizeRow({ edge, designation, inputUnit, wallCheckboxTitle }: EdgeSizeRowProps) {
  const updateEdgeLength = usePlanEditorStore((s) => s.updateEdgeLength)
  const updateEdgeAngle = usePlanEditorStore((s) => s.updateEdgeAngle)
  const setEdgeAttachedToWall = usePlanEditorStore((s) => s.setEdgeAttachedToWall)
  const hoveredEdgeId = usePlanEditorStore((s) => s.hoveredEdgeId)
  const setHoveredEdgeId = usePlanEditorStore((s) => s.setHoveredEdgeId)

  // Не переформатируем текст поля, пока в нём печатают — иначе собственный
  // commit (blur/Enter) сразу перезатирал бы то, что пользователь только
  // что ввёл, посередине набора следующего значения (см. EdgeEditor.tsx —
  // тот же паттерн, но там одна сторона и один эффект по edge?.id; здесь
  // строк много и каждая должна синхронизироваться с ВНЕШНИМИ изменениями
  // ЭТОЙ конкретной стороны — например, после adjustAndClose/cancelAdjust —
  // но не перетирать то, что пользователь печатает в этот момент).
  const lengthFocusedRef = useRef(false)
  const angleFocusedRef = useRef(false)

  const [lengthText, setLengthText] = useState(() => formatNumber(mmToLengthUnit(edge.lengthMm, inputUnit)))
  const [angleText, setAngleText] = useState(() => formatNumber(edge.angleDeg))

  useEffect(() => {
    if (!lengthFocusedRef.current) setLengthText(formatNumber(mmToLengthUnit(edge.lengthMm, inputUnit)))
  }, [edge.lengthMm, inputUnit])

  useEffect(() => {
    if (!angleFocusedRef.current) setAngleText(formatNumber(edge.angleDeg))
  }, [edge.angleDeg])

  function commitLength() {
    const mm = lengthUnitToMm(parseFloat(lengthText.replace(',', '.')), inputUnit)
    // >= MIN_EDGE_LENGTH_MM, не просто > 0 — см. комментарий у
    // MIN_EDGE_LENGTH_MM (model/store.ts): числовой ввод длины стороны минует
    // MIN_COMMIT_LENGTH_PX и раньше мог напечатать почти-дубль вершину прямо
    // на живом контуре.
    if (Number.isFinite(mm) && mm >= MIN_EDGE_LENGTH_MM) updateEdgeLength(edge.id, mm)
  }

  function commitAngle() {
    const deg = parseFloat(angleText.replace(',', '.'))
    if (Number.isFinite(deg)) updateEdgeAngle(edge.id, deg)
  }

  const isHovered = hoveredEdgeId === edge.id

  return (
    <div
      onMouseEnter={() => setHoveredEdgeId(edge.id)}
      onMouseLeave={() => setHoveredEdgeId(null)}
      style={rowStyle(isHovered)}
    >
      <span style={designationColumnStyle}>{designation}</span>
      <input
        type="text"
        inputMode="decimal"
        value={lengthText}
        onFocus={() => {
          lengthFocusedRef.current = true
        }}
        onChange={(e) => setLengthText(e.target.value)}
        onBlur={() => {
          lengthFocusedRef.current = false
          commitLength()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitLength()
          }
        }}
        style={rowInputStyle}
      />
      <input
        type="text"
        inputMode="decimal"
        value={angleText}
        onFocus={() => {
          angleFocusedRef.current = true
        }}
        onChange={(e) => setAngleText(e.target.value)}
        onBlur={() => {
          angleFocusedRef.current = false
          commitAngle()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitAngle()
          }
        }}
        style={rowInputStyle}
      />
      <span style={wallColumnStyle}>
        <input
          type="checkbox"
          checked={edge.attachedToWall ?? false}
          onChange={(e) => setEdgeAttachedToWall(edge.id, e.target.checked)}
          title={wallCheckboxTitle}
          style={wallCheckboxStyle}
        />
      </span>
    </div>
  )
}

function formatNumber(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  bottom: 16,
  width: 260,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  background: 'rgba(15, 23, 42, 0.97)',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: 14,
  color: '#e2e8f0',
  fontSize: 13,
  zIndex: 30,
  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
  overflow: 'hidden',
}

const headerRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexShrink: 0,
}

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  padding: '0 4px',
}

const emptyStyle: CSSProperties = {
  margin: 0,
  color: '#94a3b8',
  fontSize: 12,
}

const columnHeaderRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  fontSize: 11,
  color: '#94a3b8',
  flexShrink: 0,
}

const designationColumnStyle: CSSProperties = {
  flex: '0 0 40px',
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#94a3b8',
  display: 'flex',
  alignItems: 'center',
}

function rowStyle(isHovered: boolean): CSSProperties {
  return {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    padding: '3px 4px',
    borderRadius: 6,
    background: isHovered ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
  }
}

const wallColumnStyle: CSSProperties = {
  flex: '0 0 28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const wallCheckboxStyle: CSSProperties = {
  cursor: 'pointer',
  width: 14,
  height: 14,
}

const rowInputStyle: CSSProperties = {
  flex: 1,
  width: 0,
  minWidth: 0,
  background: '#0f172a',
  border: '1px solid #475569',
  borderRadius: 4,
  color: '#e2e8f0',
  fontFamily: 'monospace',
  fontSize: 13,
  padding: '4px 6px',
}
