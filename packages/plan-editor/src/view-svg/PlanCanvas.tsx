'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlanEditorStore } from '../model/store'
import { usePlanEditorInput } from '../input/usePlanEditorInput'
import { currentAnchor } from '../geometry/chain'
import { closureGap } from '../geometry/closure'
import { DEFAULT_SNAP_CONFIG } from '../geometry/types'
import { StartPoint } from './StartPoint'
import { RubberEdge } from './RubberEdge'
import { FixedEdges } from './FixedEdges'
import { ClosureGapIndicator } from './ClosureGapIndicator'
import { DynamicInputBadge } from './DynamicInputBadge'
import { Grid } from './Grid'

export interface PlanCanvasLabels {
  /** Тултип у стартовой вершины в зоне магнита замыкания — «клик замкнёт контур». */
  closeContourTooltip: string
}

interface PlanCanvasProps {
  labels: PlanCanvasLabels
}

/**
 * Корневой SVG-компонент редактора плана.
 * Тупой слой: сам ничего не вычисляет, кроме измерения собственных пикселей
 * (нужно для fit-to-screen — реальный размер холста известен только после mount).
 * Вся геометрия и вся модель — в geometry/ и model/.
 */
export function PlanCanvas({ labels }: PlanCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [canvasPx, setCanvasPx] = useState({ widthPx: 0, heightPx: 0 })

  const viewport = usePlanEditorStore((s) => s.viewport)
  const startPoint = usePlanEditorStore((s) => s.startPoint)
  const draftEdge = usePlanEditorStore((s) => s.draftEdge)
  const fixedEdges = usePlanEditorStore((s) => s.fixedEdges)
  const isClosed = usePlanEditorStore((s) => s.isClosed)
  const editingEdgeId = usePlanEditorStore((s) => s.editingEdgeId)
  const inputUnit = usePlanEditorStore((s) => s.inputUnit)
  const openEditor = usePlanEditorStore((s) => s.openEditor)
  const initViewport = usePlanEditorStore((s) => s.initViewport)
  const hoveredEdgeId = usePlanEditorStore((s) => s.hoveredEdgeId)
  const setHoveredEdgeId = usePlanEditorStore((s) => s.setHoveredEdgeId)

  // Магнит замыкания имеет смысл только когда есть что замыкать (минимум две
  // стороны — треугольник) и контур ещё не закрыт. Правило живёт в одном месте:
  // input-слой сам не знает про fixedEdges.length, только про этот булев гейт.
  const canClose = fixedEdges.length >= 2 && !isClosed

  // НЕТ onDoubleClick-шортката для closeContourExplicit (хотя обсуждался как
  // «дополнительно» к кнопке «Замкнуть контур»): браузер перед dblclick всегда
  // шлёт ДВА полноценных click — оба уже проходят через onClick ниже и
  // успевают закоммитить черновое ребро (commitDraft) в точке первого клика,
  // ДО того как сработает dblclick. Результат — лишняя случайная сторона
  // перед закрытием на любом дубль-клике не рядом со стартовой вершиной.
  // Кнопка «Замкнуть контур» (AdjustPanel) не имеет этой проблемы — она не
  // участвует в цепочке click-событий канваса вовсе.

  // Единый предикат "рисование разрешено" — шаг 3C/0. Считается ЗДЕСЬ ОДИН РАЗ
  // и передаётся в usePlanEditorInput, а не размазывается по обработчикам —
  // см. подробный комментарий у UsePlanEditorInputOptions.canDraw. Замкнутый
  // контур или открытое поле правки стороны (A2) — рисование замирает: ни
  // резиновая линия, ни буфер динамического ввода (A1) не реагируют на курсор/клавиши.
  const canDraw = !isClosed && editingEdgeId === null

  // Невязка — чистая функция от текущих сторон, пересчитывается на каждое
  // изменение fixedEdges (commit, правка длины/угла), а не только при закрытии.
  const gap = useMemo(() => closureGap(fixedEdges), [fixedEdges])

  // Якорь следующей резиновой линии — конец последней зафиксированной стороны,
  // либо startPoint, если цепочка ещё пуста. Считаем через useMemo (не через
  // store.currentAnchor() внутри селектора), потому что store.currentAnchor()
  // возвращает новый объект на каждый вызов — вызов его прямо в селекторе
  // заставил бы zustand считать "anchor изменился" на КАЖДОЕ обновление стора
  // (включая draftEdge на каждый pointermove), пересобирая usePlanEditorInput
  // без необходимости. fixedEdges — стабильная по ссылке зависимость, меняется
  // только при commitDraft/updateEdgeLength/Angle.
  const anchor = useMemo(() => currentAnchor(fixedEdges, startPoint), [fixedEdges, startPoint])

  // Fit-to-screen при монтировании и при изменении размера контейнера
  // (ресайз окна, смена ориентации на телефоне, открытие/закрытие панели рядом).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    function measure() {
      const rect = svg!.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const size = { widthPx: rect.width, heightPx: rect.height }
      setCanvasPx(size)
      initViewport(size)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(svg)
    return () => observer.disconnect()
  }, [initViewport])

  const { onPointerMove, onClick, dynamicInputBuffer } = usePlanEditorInput({
    svgRef,
    from: anchor,
    viewport,
    snapConfig: DEFAULT_SNAP_CONFIG,
    startPoint,
    canClose,
    canDraw,
  })

  const lastAdjustResult = usePlanEditorStore((s) => s.lastAdjustResult)
  const worstEdgeIndex = lastAdjustResult?.worstEdgeIndex ?? null
  const ambiguousCandidates = lastAdjustResult?.ambiguousCandidates ?? []
  const worstEdgeId = worstEdgeIndex != null ? fixedEdges[worstEdgeIndex]?.id ?? null : null
  const ambiguousEdgeIds = ambiguousCandidates.map((i) => fixedEdges[i]?.id).filter((id): id is string => id != null)

  const lastFixedPoint = fixedEdges.length > 0 ? fixedEdges[fixedEdges.length - 1].to : null

  return (
    <svg
      ref={svgRef}
      onPointerMove={onPointerMove}
      onClick={onClick}
      className="w-full h-full touch-none select-none"
      style={{ background: '#0b0f14', display: 'block' }}
    >
      {canvasPx.widthPx > 0 && <Grid widthPx={canvasPx.widthPx} heightPx={canvasPx.heightPx} />}
      <StartPoint
        point={startPoint}
        viewport={viewport}
        highlighted={draftEdge?.closesContour === true}
        tooltip={labels.closeContourTooltip}
      />
      <FixedEdges
        edges={fixedEdges}
        viewport={viewport}
        onEdgeClick={canDraw ? openEditor : undefined}
        onEdgeHover={setHoveredEdgeId}
        hoveredEdgeId={hoveredEdgeId}
        worstEdgeId={worstEdgeId}
        ambiguousEdgeIds={ambiguousEdgeIds}
      />
      {isClosed && lastFixedPoint && (
        <ClosureGapIndicator lastPoint={lastFixedPoint} startPoint={startPoint} gapDistMm={gap.distMm} viewport={viewport} />
      )}
      {draftEdge && <RubberEdge edge={draftEdge} viewport={viewport} />}
      {draftEdge && canDraw && (
        <DynamicInputBadge edge={draftEdge} buffer={dynamicInputBuffer} unit={inputUnit} viewport={viewport} />
      )}
    </svg>
  )
}
