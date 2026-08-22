'use client'

import { useState } from 'react'
import { PlanCanvas, type PlanCanvasLabels } from './view-svg/PlanCanvas'
import { EdgeEditor, type EdgeEditorLabels } from './view-html/EdgeEditor'
import { AdjustPanel, type AdjustPanelLabels } from './view-html/AdjustPanel'
import { SizesPanel, type SizesPanelLabels } from './view-html/SizesPanel'
import type { Point } from './geometry/types'

export interface PlanEditorLabels {
  canvas: PlanCanvasLabels
  edgeEditor: EdgeEditorLabels
  adjustPanel: AdjustPanelLabels
  sizesPanel: SizesPanelLabels
}

interface PlanEditorProps {
  labels: PlanEditorLabels
  /**
   * Подъём в 3D (промпт шага 3D). Пакет plan-editor не тянет зависимость на
   * three.js/pergola-core — хост (apps/crm) получает только полигон вершин
   * контура в мм и сам строит цепочку computeFrame → CutPiece[] → сцена.
   * undefined — кнопка «В 3D» не рендерится (см. AdjustPanel.onTo3D).
   * Второй аргумент — индексы пристенных сторон, см. AdjustPanel.onTo3D.
   */
  onTo3D?: (polygonMm: Point[], wallEdgeIndices: number[]) => void
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
export function PlanEditor({ labels, onTo3D }: PlanEditorProps) {
  // Открыта ли панель «Изменить размеры» — локальный UI-тумблер, не в сторе:
  // это состояние видимости конкретного HTML-оверлея, а не часть модели плана
  // (в отличие от editingEdgeId, который влияет на canDraw и на то, что рисует
  // канвас). Лежит здесь, а не внутри AdjustPanel/SizesPanel по отдельности,
  // потому что кнопка-переключатель живёт в AdjustPanel, а сама панель —
  // отдельный компонент рядом; without an обычный React state lift up здесь
  // нет способа связать их, не заводя это в zustand.
  const [sizesPanelOpen, setSizesPanelOpen] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <PlanCanvas labels={labels.canvas} />
      <EdgeEditor labels={labels.edgeEditor} />
      {sizesPanelOpen ? (
        <SizesPanel isOpen={sizesPanelOpen} onClose={() => setSizesPanelOpen(false)} labels={labels.sizesPanel} />
      ) : (
        <AdjustPanel labels={labels.adjustPanel} onOpenSizes={() => setSizesPanelOpen(true)} onTo3D={onTo3D} />
      )}
    </div>
  )
}
