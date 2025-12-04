import type { Deal } from './deal-types'
import { useCRMTranslations } from './useCRMTranslations'

interface DealCardProps {
  deal: Deal
  onDragStart: () => void
  onClick: () => void
  formatCurrency: (amount: number | null | undefined) => string
  formatDate: (dateStr: string | null | undefined) => string
}

export function DealCard({ 
  deal, 
  onDragStart, 
  onClick,
  formatCurrency,
  formatDate
}: DealCardProps) {
  const t = useCRMTranslations()
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
          <div className="text-sm text-white/70">
            📞 {deal.customer_phone}
          </div>
        )}
        
        {deal.price && (
          <div className="text-lg font-bold text-green-400">
            {formatCurrency(deal.price)}
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

