import type { Deal } from './deal-types'
import { getStages } from './deal-types'
import { KanbanColumn } from './KanbanColumn'
import { useCRMTranslations } from './useCRMTranslations'

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
  
  function getDealsByStage(stage: string) {
    return deals.filter(deal => {
      // Нормализуем stage: если null, undefined или пустая строка, используем 'new'
      const dealStage = deal.stage || 'new'
      return dealStage === stage
    })
  }
  

  return (
    <div className="overflow-x-auto pb-4 -mx-4 px-4">
      <div className="flex gap-4 min-w-max">
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

