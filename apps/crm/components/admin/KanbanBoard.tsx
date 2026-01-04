import type { Deal } from './deal-types'
import { getStages } from './deal-types'
import { KanbanColumn } from './KanbanColumn'
import { useCRMTranslations } from './useCRMTranslations'
import { useRef } from 'react'

interface KanbanBoardProps {
  deals: Deal[]
  onDragOver: (e: React.DragEvent) => void
  onDrop: (stage: string) => void
  onDealDragStart: (deal: Deal) => void
  onDealClick: (deal: Deal) => void
}

export function KanbanBoard({
  deals,
  onDragOver,
  onDrop,
  onDealDragStart,
  onDealClick
}: KanbanBoardProps) {
  const t = useCRMTranslations()
  const stages = getStages(t.deals)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  
  function getDealsByStage(stage: string) {
    return deals.filter(deal => {
      // Нормализуем stage: если null, undefined или пустая строка, используем 'new'
      const dealStage = deal.stage || 'new'
      return dealStage === stage
    })
  }
  

  return (
    <div
      ref={scrollRef}
      className="flex h-full min-h-0 overflow-x-auto pb-4 -mx-4 px-4"
      onWheel={(e) => {
        // Allow mouse wheel to scroll the board horizontally (trackpads do this naturally)
        // Don't interfere with pinch-to-zoom (ctrl+wheel) or explicit horizontal wheel (shift)
        if (e.ctrlKey || e.shiftKey) return

        const el = scrollRef.current
        if (!el) return

        const canScrollX = el.scrollWidth > el.clientWidth
        if (!canScrollX) return

        // If the wheel is mostly vertical, convert to horizontal scroll
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          el.scrollLeft += e.deltaY
          e.preventDefault()
        }
      }}
    >
      <div className="flex h-full min-h-0 gap-4 min-w-max">
        {stages.map(stage => {
          const stageDeals = getDealsByStage(stage.id)
          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={stageDeals}
              onDragOver={onDragOver}
              onDrop={() => onDrop(stage.id)}
              onDealDragStart={onDealDragStart}
              onDealClick={onDealClick}
            />
          )
        })}
      </div>
    </div>
  )
}

