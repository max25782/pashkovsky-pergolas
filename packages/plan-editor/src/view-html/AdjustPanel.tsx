'use client'

import { usePlanEditorStore } from '../model/store'
import type { AdjustContourResult } from '../geometry/adjust'
import { toPolygon, wallEdgeIndicesFromChain } from '../geometry/chain'
import type { Point } from '../geometry/types'

export interface AdjustPanelLabels {
  /**
   * «Замкнуть контур» — активна при fixedEdges.length >= 3 && !isClosed
   * (см. store.ts closeContourExplicit). Явно замыкает контур геометрически;
   * не делает уравнивания — это отдельная кнопка (alignButton).
   */
  closeContourButton: string
  /** Причина disabled у closeContourButton, когда сторон меньше 3. */
  closeContourNeedMoreSides: string
  /**
   * Показывается вместо/рядом с closeContourButton, когда последняя попытка
   * явного замыкания провалилась из-за самопересечения (closeContourError
   * === 'selfIntersecting') — см. store.ts. Не тултип disabled-кнопки, а
   * персистентное сообщение об ошибке: пользователю нужно исправить форму.
   */
  closeContourSelfIntersects: string
  /**
   * «Выровнять» — активна только когда контур уже замкнут (isClosed). ПЕРЕИМЕНОВАНО
   * из «Замкнуть и выровнять»: старое название обманывало — canAdjust требовал
   * isClosed уже true, то есть кнопка сама контур никогда не замыкала.
   */
  alignButton: string
  /** Причина disabled у alignButton и to3DButton, когда контур ещё не замкнут. */
  notClosedHint: string
  /** Причина disabled у to3DButton, когда контур замкнут, но уравнивание ещё не запускалось. */
  notAdjustedHint: string
  /** Кнопка-переключатель панели «Изменить размеры» (SizesPanel) — рядом с alignButton. */
  openSizesButton: string
  /** Кнопка «В 3D» — активна только когда контур замкнут и уравнен (см. onTo3D). */
  to3DButton: string
  acceptButton: string
  cancelButton: string
  /** Невязка до уравнивания меньше GAP_NEGLIGIBLE_MM — контур и так сходился. */
  noGap: string
  gapDistributed: (gapMm: number) => string
  /** Случай 1 — один явный виновник. edgeNumber — 1-индексный порядковый номер стороны, как видит пользователь. */
  singleCulprit: (edgeNumber: number, residualMm: number, avgMm: number) => string
  /** Случай 2 — неоднозначность. Нельзя показывать пальцем на одну — весь список кандидатов. */
  ambiguous: (edgeNumbers: number[]) => string
  /** Случай 3 — недоопределённость угла у нескольких сторон, независимая оговорка. */
  underDetermined: (count: number) => string
}

interface AdjustPanelProps {
  labels: AdjustPanelLabels
  /** Открывает панель «Изменить размеры» (управляется снаружи — см. PlanEditor.tsx). */
  onOpenSizes: () => void
  /**
   * Подъём в 3D (промпт шага 3D). Редактор НЕ разговаривает с 3D напрямую —
   * отдаёт хосту (apps/crm) только полигон вершин в мм, дальше цепочка
   * computeFrame → CutPiece[] → билдер геометрии → сцена целиком снаружи
   * пакета plan-editor, который ничего не знает про three.js/pergola-core.
   * undefined — хост не поддерживает 3D-подъём, кнопка не рендерится вовсе.
   *
   * wallEdgeIndices — индексы сторон с attachedToWall (см. FixedEdge,
   * wallEdgeIndicesFromChain), в том же индексировании, что и polygonMm
   * (сторона i идёт от вершины i к (i+1)%n) — хост передаёт их прямиком в
   * PergolaSpec.wallEdgeIndices ядра, ничего не пересчитывая (промпт
   * «крепление к стене»).
   */
  onTo3D?: (polygonMm: Point[], wallEdgeIndices: number[]) => void
}

/** Ниже этого порога (мм) невязка ДО уравнивания считается шумом чисел, а не реальной ошибкой замера. */
const GAP_NEGLIGIBLE_MM = 2
/** underDetermined показываем только когда угол не задан у НЕСКОЛЬКИХ сторон — одна такая сторона обычно и есть предполагаемая точка магнита замыкания. */
const UNDER_DETERMINED_MIN_COUNT = 2

/**
 * Часть B — три отдельных, честно названных действия + панель итога:
 *
 *   1. «Замкнуть контур» (closeContourButton) — ТОЛЬКО замыкает, само по себе
 *      никакого уравнивания не делает. Активна при >=3 сторонах и !isClosed.
 *      Перед фактическим замыканием проверяет самопересечение результирующего
 *      полигона (см. store.ts closeContourExplicit) — при провале контур НЕ
 *      замыкается, показывается closeContourSelfIntersects.
 *   2. «Выровнять» (alignButton) — ТОЛЬКО уравнивает уже замкнутый контур least-
 *      squares решателем. Активна при isClosed. Названа так после того, как
 *      старое название «Замкнуть и выровнять» оказалось ложным обещанием:
 *      canAdjust всегда требовал isClosed=true до вызова, то есть замыкать
 *      контур эта кнопка не умела никогда — только уравнивать уже замкнутый.
 *   3. «В 3D» (to3DButton) — активна при isClosed && последнее уравнивание
 *      выполнено (lastAdjustResult !== null).
 *
 * Каждая disabled-кнопка обязана объяснять причину — либо статичным текстом
 * рядом (closeContourNeedMoreSides), либо через notClosedHint/notAdjustedHint
 * (общие для alignButton/to3DButton, т.к. первая причина у обоих одна и та же).
 *
 * Три диагностических случая итога уравнивания — три РАЗНЫЕ формулировки:
 *   1. Один явный виновник — worstEdgeIndex, без ambiguousCandidates.
 *   2. Неоднозначность (ambiguousCandidates.length > 1) — нельзя указывать на
 *      одну сторону, только на весь список кандидатов сразу.
 *   3. Недоопределённость угла — независимая оговорка, может сопровождать
 *      как случай 1, так и случай 2 (не альтернатива им, а дополнение).
 *
 * labels — все строки приходят СНАРУЖИ (i18n CRM), пакет ничего не хардкодит
 * и не тянет зависимость на конкретный i18n-фреймворк — см. apps/crm для
 * реальной прокладки через существующий механизм переводов.
 */
export function AdjustPanel({ labels, onOpenSizes, onTo3D }: AdjustPanelProps) {
  const fixedEdges = usePlanEditorStore((s) => s.fixedEdges)
  const isClosed = usePlanEditorStore((s) => s.isClosed)
  const closeContourError = usePlanEditorStore((s) => s.closeContourError)
  const closeContourExplicit = usePlanEditorStore((s) => s.closeContourExplicit)
  const lastAdjustResult = usePlanEditorStore((s) => s.lastAdjustResult)
  const preAdjustSnapshot = usePlanEditorStore((s) => s.preAdjustSnapshot)
  const adjustAndClose = usePlanEditorStore((s) => s.adjustAndClose)
  const acceptAdjust = usePlanEditorStore((s) => s.acceptAdjust)
  const cancelAdjust = usePlanEditorStore((s) => s.cancelAdjust)

  const canCloseContour = fixedEdges.length >= 3 && !isClosed
  const closeContourReason = !isClosed && fixedEdges.length < 3 ? labels.closeContourNeedMoreSides : null

  // Замкнуть/выровнять осмысленно только для полигона — минимум треугольник;
  // с введением явного замыкания isClosed=true уже подразумевает >=3 сторон,
  // отдельная проверка длины здесь больше не нужна (в отличие от старого canAdjust).
  const canAlign = isClosed
  const alignReason = !isClosed ? labels.notClosedHint : null

  const showResult = lastAdjustResult !== null && preAdjustSnapshot !== null
  // «Контур замкнут и уравнен» — lastAdjustResult переживает acceptAdjust
  // (чистит только preAdjustSnapshot) и обнуляется cancelAdjust, поэтому
  // именно он, а не showResult, верно отражает «уравнивание было и принято/
  // ожидает решения», а не «уравнивание либо не запускалось, либо отменено».
  const canBuild3D = isClosed && lastAdjustResult !== null
  const to3DReason = !isClosed ? labels.notClosedHint : lastAdjustResult === null ? labels.notAdjustedHint : null

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        maxWidth: 320,
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid #334155',
        borderRadius: 10,
        padding: 14,
        color: '#e2e8f0',
        fontSize: 13,
        zIndex: 30,
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
      }}
    >
      {!showResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={!canCloseContour}
              onClick={closeContourExplicit}
              title={closeContourReason ?? undefined}
              style={buttonStyle(canCloseContour)}
            >
              {labels.closeContourButton}
            </button>
            <button
              type="button"
              disabled={!canAlign}
              onClick={adjustAndClose}
              title={alignReason ?? undefined}
              style={buttonStyle(canAlign)}
            >
              {labels.alignButton}
            </button>
          </div>

          {/*
            Персистентное сообщение об ошибке (не тултип disabled-кнопки):
            'selfIntersecting' — реалистичный путь (кнопка/дубль-клик на валидном
            наборе сторон, но зигзаг). 'tooFewEdges' сюда попадает практически
            только через двойной клик на канвасе раньше времени (кнопка и так
            задисейблена + title объясняет причину) — но раз путь всё равно
            существует, ошибка должна быть видна, а не тихо проглочена.
          */}
          {closeContourError === 'selfIntersecting' && (
            <p style={{ margin: 0, lineHeight: 1.4, color: '#f87171' }}>{labels.closeContourSelfIntersects}</p>
          )}
          {closeContourError === 'tooFewEdges' && (
            <p style={{ margin: 0, lineHeight: 1.4, color: '#f87171' }}>{labels.closeContourNeedMoreSides}</p>
          )}

          {/*
            «Изменить размеры» — рядом с кнопками замыкания/выравнивания (см.
            промпт): клик по стороне на канвасе работает, но невидим,
            пользователь о нём не догадается. Эта кнопка — явная,
            обнаруживаемая точка входа в ту же SizesPanel. Доступна независимо
            от canAlign — редактировать размеры можно и до замыкания контура.
          */}
          <button type="button" onClick={onOpenSizes} style={buttonStyle(true, true)}>
            {labels.openSizesButton}
          </button>
        </div>
      )}

      {showResult && lastAdjustResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {renderDiagnosisLines(lastAdjustResult, labels).map((line, i) => (
            <p key={i} style={{ margin: 0, lineHeight: 1.4 }}>
              {line}
            </p>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={acceptAdjust} style={buttonStyle(true)}>
              {labels.acceptButton}
            </button>
            <button type="button" onClick={cancelAdjust} style={buttonStyle(true, true)}>
              {labels.cancelButton}
            </button>
          </div>
        </div>
      )}

      {/*
        «В 3D» — отдельная строка, видимая независимо от showResult (в отличие
        от «Изменить размеры»/«Выровнять», которые прячутся, пока показан итог
        уравнивания). Кнопка не про диагностику уравнивания, это отдельный
        переход в другой вид — держать её видимой постоянно honestly отражает,
        что подъём в 3D доступен и до, и после принятия результата.
      */}
      {onTo3D && (
        <div style={{ marginTop: 8, display: 'flex' }}>
          <button
            type="button"
            disabled={!canBuild3D}
            onClick={() => onTo3D(toPolygon(fixedEdges), wallEdgeIndicesFromChain(fixedEdges))}
            title={to3DReason ?? undefined}
            style={buttonStyle(canBuild3D)}
          >
            {labels.to3DButton}
          </button>
        </div>
      )}
    </div>
  )
}

function renderDiagnosisLines(result: AdjustContourResult, labels: AdjustPanelLabels): string[] {
  const lines: string[] = []

  if (result.initialGapMm < GAP_NEGLIGIBLE_MM) {
    lines.push(labels.noGap)
  } else {
    lines.push(labels.gapDistributed(result.initialGapMm))

    if (result.ambiguousCandidates.length > 1) {
      // Случай 2 — намеренно НЕ показываем worstEdgeIndex отдельно: система
      // математически не может отличить кандидатов друг от друга.
      lines.push(labels.ambiguous(result.ambiguousCandidates.map((i) => i + 1)))
    } else if (result.worstEdgeIndex !== null) {
      const measured = result.residuals.filter((r) => !r.wasUnmeasured)
      const avgMm =
        measured.length > 0
          ? measured.reduce((sum, r) => sum + Math.abs(r.lengthResidualMm), 0) / measured.length
          : 0
      const residualMm = Math.abs(result.residuals[result.worstEdgeIndex].lengthResidualMm)
      lines.push(labels.singleCulprit(result.worstEdgeIndex + 1, residualMm, avgMm))
    }
  }

  if (result.underDeterminedEdgeIds.length >= UNDER_DETERMINED_MIN_COUNT) {
    lines.push(labels.underDetermined(result.underDeterminedEdgeIds.length))
  }

  return lines
}

function buttonStyle(enabled: boolean, secondary = false) {
  return {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 6,
    border: secondary ? '1px solid #475569' : 'none',
    background: enabled ? (secondary ? 'transparent' : '#2563eb') : '#334155',
    color: enabled ? '#f8fafc' : '#64748b',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    fontWeight: 600,
  }
}
