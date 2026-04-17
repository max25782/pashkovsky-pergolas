import type { Deal } from './deal-types'
import type { DealMaterialOrdersSummary } from './hooks/useDealMaterialOrdersTotalsMap'
import { useCRMTranslations } from './useCRMTranslations'
import { PhoneActions } from './PhoneActions'

interface DealCardProps {
  deal: Deal
  paidToDate?: number
  /** Total labor cost from worker_shifts (batched on board load). */
  laborCost?: number
  /** Sum of material_orders.total_price (non-cancelled), batched on board load. */
  materialOrdersSummary?: DealMaterialOrdersSummary
  onDragStart: () => void
  onClick: () => void
  formatCurrency: (amount: number | null | undefined) => string
  formatDate: (dateStr: string | null | undefined) => string
}

export function DealCard({ 
  deal, 
  paidToDate,
  laborCost,
  materialOrdersSummary,
  onDragStart, 
  onClick,
  formatCurrency,
  formatDate
}: DealCardProps) {
  const t = useCRMTranslations()
  const material = Number(deal.my_cost ?? 0)
  const labor = laborCost != null ? Number(laborCost) : 0
  const totalInternalCosts = material + labor
  const ordersTotal = materialOrdersSummary?.totalPrice ?? 0
  const ordersCount = materialOrdersSummary?.orderCount ?? 0
  const priceNum =
    deal.price != null && Number.isFinite(Number(deal.price)) ? Number(deal.price) : null
  const estimatedProfit = priceNum != null ? priceNum - totalInternalCosts : null
  const showCostBreakdown =
    deal.price != null || material > 0 || labor > 0 || ordersCount > 0

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-white/5 border border-white/10 rounded-lg p-4 cursor-move hover:bg-white/10 hover:border-white/20 transition-all shadow-lg hover:shadow-xl"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">
              {deal.customer_name || t.deals.withoutName}
            </h4>
            {deal.customer_city && (
              <p className="text-xs text-white/50">{deal.customer_city}</p>
            )}
          </div>
          {deal.project_type && (
            <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-200 text-xs whitespace-nowrap">
              {t.deals.projectTypes[deal.project_type as keyof typeof t.deals.projectTypes] || deal.project_type}
            </span>
          )}
        </div>
        
        {deal.customer_phone && (
          <div className="text-sm" onClick={(e) => e.stopPropagation()}>
            <PhoneActions phone={deal.customer_phone} leadName={deal.customer_name ?? undefined} variant="full" />
          </div>
        )}
        
        {deal.price && (
          <div className="text-lg font-bold text-green-400">
            {formatCurrency(deal.price)}
          </div>
        )}
        {deal.customer_type === 'contractor' && (paidToDate != null || deal.price) && (
          <div className="text-xs text-white/60 space-y-0.5">
            <div>{t.deals.paidToDate}: {formatCurrency(paidToDate ?? 0)}</div>
            <div>{t.deals.remaining}: {formatCurrency((deal.price ?? 0) - (paidToDate ?? 0))}</div>
          </div>
        )}

        {showCostBreakdown && (
          <div className="text-xs text-amber-200/90 space-y-0.5 pt-1 border-t border-white/10">
            <div>
              {t.deals.materialCost}: {formatCurrency(material)}
            </div>
            <div>
              {t.deals.laborCost}: {formatCurrency(labor)}
            </div>
            <div className="font-semibold text-amber-100">
              {t.deals.totalCosts}: {formatCurrency(totalInternalCosts)}
            </div>
            {ordersCount > 0 && (
              <div className="text-amber-200/80 pt-0.5">
                {t.deals.materialOrdersSystemTotal}: {formatCurrency(ordersTotal)}
                <span className="text-white/45"> · {t.deals.materialOrdersOrderCount(ordersCount)}</span>
              </div>
            )}
            {estimatedProfit != null && (
              <div
                className={
                  estimatedProfit >= 0 ? 'pt-1 font-semibold text-emerald-300' : 'pt-1 font-semibold text-rose-300'
                }
              >
                {t.deals.kanbanEstimatedProfit}: {formatCurrency(estimatedProfit)}
              </div>
            )}
            <p className="text-[11px] text-white/35 pt-1 leading-snug">{t.deals.kanbanTapForDetails}</p>
          </div>
        )}
        
        {(deal.width || deal.depth) && (
          <div className="text-xs text-white/60">
            📐 {deal.width || '?'} × {deal.depth || '?'} {t.deals.cm}
          </div>
        )}
        
        {deal.material && (
          <div className="text-xs text-white/60">
            🏗️ {deal.material}
          </div>
        )}
        
        {deal.color_ral && (
          <div className="text-xs text-white/60">
            🎨 RAL {deal.color_ral}
          </div>
        )}
        
        {deal.manager && (
          <div className="text-xs text-white/50 pt-2 border-t border-white/10">
            👤 {deal.manager}
          </div>
        )}
        
        <div className="text-xs text-white/40 pt-1">
          {formatDate(deal.created_at)}
        </div>
      </div>
    </div>
  )
}

