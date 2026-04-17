import type { Deal } from './deal-types'
import type { DealMaterialOrdersSummary } from './hooks/useDealMaterialOrdersTotalsMap'
import { DealCard } from './DealCard'
import { formatCurrency, formatDate } from './deal-utils'
import { useCRMTranslations } from './useCRMTranslations'

interface KanbanColumnProps {
  stage: { id: string; label: string; color: string }
  deals: Deal[]
  paymentsMap?: Record<string, number>
  laborMap?: Record<string, number>
  materialOrdersMap?: Record<string, DealMaterialOrdersSummary>
  onDragOver: (e: React.DragEvent) => void
  onDrop: () => void
  onDealDragStart: (deal: Deal) => void
  onDealClick: (deal: Deal) => void
}

export function KanbanColumn({
  stage,
  deals,
  paymentsMap = {},
  laborMap = {},
  materialOrdersMap = {},
  onDragOver,
  onDrop,
  onDealDragStart,
  onDealClick
}: KanbanColumnProps) {
  const t = useCRMTranslations()
  return (
    <div
      className="flex-shrink-0 w-[92vw] min-w-[92vw] sm:w-80 sm:min-w-[320px]"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
        <div className={`${stage.color} px-4 py-3 flex items-center justify-between`}>
          <h3 className="font-semibold text-white">
            {stage.label}
          </h3>
          <span className="bg-white/20 px-2 py-1 rounded text-sm font-medium">
            {deals.length}
          </span>
        </div>
        <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
          {deals.map(deal => (
            <DealCard
              key={deal.id}
              deal={deal}
              paidToDate={paymentsMap[deal.id]}
              laborCost={laborMap[deal.id]}
              materialOrdersSummary={materialOrdersMap[deal.id]}
              onDragStart={() => onDealDragStart(deal)}
              onClick={() => onDealClick(deal)}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          ))}
          {deals.length === 0 && (
            <div className="text-center text-white/30 py-8 text-sm">
              {t.status.noDeals}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

