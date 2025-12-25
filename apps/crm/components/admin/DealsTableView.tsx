import type { Deal } from './deal-types'
import { getStages } from './deal-types'
import { formatDate, formatCurrency, formatDimensions } from './deal-utils'
import { useCRMTranslations } from './useCRMTranslations'

interface DealsTableViewProps {
  deals: Deal[]
  loading: boolean
  onDealClick: (deal: Deal) => void
  onDealDelete: (deal: Deal) => void
}

export function DealsTableView({
  deals,
  loading,
  onDealClick,
  onDealDelete
}: DealsTableViewProps) {
  const t = useCRMTranslations()
  const stages = getStages(t.deals)
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.createdAt}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.customerName}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.customerPhone}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.projectType}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.width} / {t.deals.depth}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.price}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.stage}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.deals.manager}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.common.delete}</th>
          </tr>
        </thead>
        <tbody>
          {deals.map(deal => (
            <DealTableRow
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick(deal)}
              onDelete={() => onDealDelete(deal)}
            />
          ))}
          {deals.length === 0 && !loading && (
            <tr>
              <td className="p-8 text-center text-white/40" colSpan={9}>
                {t.status.noDeals}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function DealTableRow({
  deal,
  onClick,
  onDelete
}: {
  deal: Deal
  onClick: () => void
  onDelete: () => void
}) {
  const t = useCRMTranslations()
  const stages = getStages(t.deals)
  const stage = stages.find(s => s.id === deal.stage)
  return (
    <tr 
      className="border-t border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <td className="p-3 whitespace-nowrap text-white/70">{formatDate(deal.created_at)}</td>
      <td className="p-3">
        <div className="font-medium">{deal.customer_name || '-'}</div>
        {deal.customer_city && (
          <div className="text-xs text-white/50">{deal.customer_city}</div>
        )}
      </td>
      <td className="p-3 text-white/70">{deal.customer_phone || '-'}</td>
      <td className="p-3">
        <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-200 text-xs">
          {deal.project_type ? (t.deals.projectTypes[deal.project_type as keyof typeof t.deals.projectTypes] || deal.project_type) : '-'}
        </span>
      </td>
      <td className="p-3 text-white/70">
        {formatDimensions(deal.width, deal.depth)}
      </td>
      <td className="p-3 font-semibold text-green-400">
        {formatCurrency(deal.price)}
      </td>
      <td className="p-3">
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          stage?.color || 'bg-gray-500'
        } text-white`}>
          {stage?.label || t.deals.stages.new}
        </span>
      </td>
      <td className="p-3 text-white/70">{deal.manager || '-'}</td>
      <td className="p-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-200 text-xs"
        >
          {t.common.delete}
        </button>
      </td>
    </tr>
  )
}

