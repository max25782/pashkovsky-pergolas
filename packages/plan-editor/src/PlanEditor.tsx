'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { beamPlanWidthForDrawing, buildPlanEditorOverlayModel, contourSideWidthMm } from '@pashkovsky/pergola-core'
import type { PlanConstructionParams, ProfileDimensions } from '@pashkovsky/pergola-core'
import { PlanCanvas, type PlanCanvasLabels } from './view-svg/PlanCanvas'
import {
  PlanEditorConstructionProvider,
  buildConstructionContextValue,
} from './model/constructionContext'
import { EdgeEditor, type EdgeEditorLabels } from './view-html/EdgeEditor'
import { AdjustPanel, type AdjustPanelLabels } from './view-html/AdjustPanel'
import { SizesPanel, type SizesPanelLabels } from './view-html/SizesPanel'
import type { FixedEdge, Point } from './geometry/types'
import { toPolygon, wallEdgeIndicesFromChain } from './geometry/chain'
import { closureGap } from './geometry/closure'
import { isSimplePolygon } from './geometry/selfIntersection'
import { createPlanEditorStore, PlanEditorStoreContext, useBoundPlanEditorStore } from './model/store'

export interface PlanEditorLabels {
  canvas: PlanCanvasLabels
  edgeEditor: EdgeEditorLabels
  adjustPanel: AdjustPanelLabels
  sizesPanel: SizesPanelLabels
}

interface PlanEditorProps {
  labels: PlanEditorLabels
  /** Closed contour to show on mount (draft restore). Ignored after the store is created. */
  initialContour?: {
    polygon: Point[]
    wallIndices: number[]
    measuredOuterLengthMmByEdgeIndex?: Array<number | null>
  }
  /**
   * Подъём в 3D (промпт шага 3D). Пакет plan-editor не тянет зависимость на
   * three.js/pergola-core — хост (apps/crm) получает только полигон вершин
   * контура в мм и сам строит цепочку computeFrame → CutPiece[] → сцена.
   * undefined — кнопка «В 3D» не рендерится (см. AdjustPanel.onTo3D).
   * Второй аргумент — индексы пристенных сторон, см. AdjustPanel.onTo3D.
   */
  onTo3D?: (polygonMm: Point[], wallEdgeIndices: number[]) => void
  /** Fired when the contour or its closed/simple state changes. Host owns persistence. */
  onContourChange?: (contour: PlanContourSnapshot) => void
  /** When set and contour is closed, draws Max outer dimensions, angles, dividers. */
  construction?: {
    params: PlanConstructionParams
    profiles: Map<string, ProfileDimensions>
    selectedDividerId?: string | null
    onSelectDivider?: (id: string | null) => void
  }
}

export interface PlanContourSnapshot {
  polygon: Point[]
  wallIndices: number[]
  isClosed: boolean
  isSimple: boolean
  measuredOuterLengthMmByEdgeIndex?: Array<number | null>
}

/**
 * Композиция всего редактора плана — то, что реально монтирует apps/crm.
 * Единственная обёртка с `position: relative` — HTML-оверлеи (EdgeEditor,
 * AdjustPanel) позиционируются АБСОЛЮТНО ОТНОСИТЕЛЬНО НЕЁ, а не страницы
 * (см. промпт шага 3C: "иначе сайдбар и хедер CRM сдвинут всё на свою
 * величину"). Родитель, в который кладут <PlanEditor/>, обязан задать
 * реальную высоту (например h-[600px] или flex-1 в колонке с фиксированной
 * высотой) — без этого ResizeObserver внутри PlanCanvas намерит 0 и
 * fit-to-screen даст мусор (см. промпт шага 3C, "куда это поставить в CRM").
 *
 * labels приходят снаружи целиком — сам пакет не тянет зависимость на
 * конкретный механизм i18n CRM, только на форму объекта строк/функций.
 */
function ContourReporter({ onContourChange }: { onContourChange?: (contour: PlanContourSnapshot) => void }) {
  const fixedEdges = useBoundPlanEditorStore((s) => s.fixedEdges)
  const isClosed = useBoundPlanEditorStore((s) => s.isClosed)
  const onContourChangeRef = useRef(onContourChange)
  onContourChangeRef.current = onContourChange

  useEffect(() => {
    const report = onContourChangeRef.current
    if (!report) return
    const polygon = toPolygon(fixedEdges)
    const measured = fixedEdges.map((edge) => edge.measuredOuterLengthMm ?? null)
    report({
      polygon,
      wallIndices: wallEdgeIndicesFromChain(fixedEdges),
      isClosed,
      isSimple: polygon.length >= 3 && isSimplePolygon(polygon),
      measuredOuterLengthMmByEdgeIndex: measured.some((v) => v != null) ? measured : undefined,
    })
  }, [fixedEdges, isClosed])

  return null
}

export function PlanEditor({ labels, onTo3D, onContourChange, initialContour, construction }: PlanEditorProps) {
  const [store] = useState(() => {
    const created = createPlanEditorStore()
    if (initialContour && initialContour.polygon.length >= 3) {
      created.getState().hydrateContour(
        initialContour.polygon,
        initialContour.wallIndices,
        initialContour.measuredOuterLengthMmByEdgeIndex,
      )
    }
    return created
  })

  return (
    <PlanEditorStoreContext.Provider value={store}>
      <ContourReporter onContourChange={onContourChange} />
      <PlanEditorBody labels={labels} onTo3D={onTo3D} construction={construction} />
    </PlanEditorStoreContext.Provider>
  )
}

function PlanEditorBody({ labels, onTo3D, construction }: Pick<PlanEditorProps, 'labels' | 'onTo3D' | 'construction'>) {
  const fixedEdges = useBoundPlanEditorStore((s) => s.fixedEdges)
  const isClosed = useBoundPlanEditorStore((s) => s.isClosed)

  const constructionValue = useMemo(() => {
    if (!construction || !isClosed || fixedEdges.length < 3) return null

    const overlayForFixedEdges = (edges: FixedEdge[]) => {
      if (edges.length < 3) return null
      const contour = edges.map((e) => [e.from.x, e.from.y] as [number, number])
      const measuredOuterLengthMmByEdgeId = new Map<string, number>()
      for (const edge of edges) {
        if (edge.measuredOuterLengthMm != null) {
          measuredOuterLengthMmByEdgeId.set(edge.id, edge.measuredOuterLengthMm)
        }
      }
      return buildPlanEditorOverlayModel({
        contour,
        wallEdgeIndices: wallEdgeIndicesFromChain(edges),
        params: construction.params,
        profiles: construction.profiles,
        edgeIds: edges.map((e) => e.id),
        contourClosureGapMm: closureGap(edges).distMm,
        edgeHeadingDeg: edges.map((edge) => edge.angleDeg),
        measuredOuterLengthMmByEdgeId,
      })
    }

    const overlay = overlayForFixedEdges(fixedEdges)
    if (!overlay) return null
    const beamPlanWidthMm = beamPlanWidthForDrawing(
      construction.profiles,
      construction.params.beamProfileId,
    ).planWidthMm
    const wallEdgeIndices = wallEdgeIndicesFromChain(fixedEdges)
    const planWidthForEdge = (edgeIndex: number) => contourSideWidthMm(
      construction.profiles,
      edgeIndex,
      {
        wallEdgeIndices,
        beamProfileId: construction.params.beamProfileId,
        wallProfileId: construction.params.wallProfileId,
        wallBeamWidthVersion: construction.params.wallBeamWidthVersion,
      },
    )
    return buildConstructionContextValue(overlay, overlayForFixedEdges, beamPlanWidthMm, planWidthForEdge)
  }, [construction, isClosed, fixedEdges])

  // Открыта ли панель «Изменить размеры» — локальный UI-тумблер, не в сторе:
  // это состояние видимости конкретного HTML-оверлея, а не часть модели плана
  // (в отличие от editingEdgeId, который влияет на canDraw и на то, что рисует
  // канвас). Лежит здесь, а не внутри AdjustPanel/SizesPanel по отдельности,
  // потому что кнопка-переключатель живёт в AdjustPanel, а сама панель —
  // отдельный компонент рядом; without an обычный React state lift up здесь
  // нет способа связать их, не заводя это в zustand.
  const [sizesPanelOpen, setSizesPanelOpen] = useState(false)
  const applyOuterLengths = useBoundPlanEditorStore((s) => s.applyOuterLengths)
  const beamProfileId = construction?.params.beamProfileId
  const previousBeamProfileId = useRef(beamProfileId)
  const edgesRef = useRef(fixedEdges)
  edgesRef.current = fixedEdges

  // An explicit beam-profile change rebuilds centerlines from the typed
  // outers. Opening a saved plan does not: the first id is only remembered.
  useEffect(() => {
    if (!construction || !beamProfileId) return
    if (previousBeamProfileId.current === beamProfileId) return
    previousBeamProfileId.current = beamProfileId
    const edges = edgesRef.current
    if (edges.length < 3) return
    if (!edges.every((edge) => typeof edge.measuredOuterLengthMm === 'number')) return
    const beamPlanWidthMm = beamPlanWidthForDrawing(construction.profiles, beamProfileId).planWidthMm
    const wallEdgeIndices = wallEdgeIndicesFromChain(edges)
    const planWidthForEdge = (edgeIndex: number) => contourSideWidthMm(
      construction.profiles,
      edgeIndex,
      {
        wallEdgeIndices,
        beamProfileId,
        wallProfileId: construction.params.wallProfileId,
        wallBeamWidthVersion: construction.params.wallBeamWidthVersion,
      },
    )
    applyOuterLengths(
      edges.map((edge) => edge.measuredOuterLengthMm as number),
      0,
      beamPlanWidthMm,
      planWidthForEdge,
    )
  }, [applyOuterLengths, beamProfileId, construction])

  return (
    <PlanEditorConstructionProvider value={constructionValue}>
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <PlanCanvas
          labels={labels.canvas}
          constructionOverlay={constructionValue?.overlay ?? null}
          selectedDividerId={construction?.selectedDividerId}
          onSelectDivider={construction?.onSelectDivider}
        />
        <EdgeEditor labels={labels.edgeEditor} />
      <AdjustPanel labels={labels.adjustPanel} onOpenSizes={() => setSizesPanelOpen(true)} onTo3D={onTo3D} />
      {sizesPanelOpen ? (
        <SizesPanel isOpen={sizesPanelOpen} onClose={() => setSizesPanelOpen(false)} labels={labels.sizesPanel} />
      ) : null}
      </div>
    </PlanEditorConstructionProvider>
  )
}
