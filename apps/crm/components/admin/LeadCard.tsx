import type { Lead } from './lead-types'
import { LEAD_STATUSES } from './lead-types'
import { formatDate } from './deal-utils'
import { PhoneActions } from './PhoneActions'

interface LeadCardProps {
  lead: Lead
  onClick: () => void
  /** When provided, card becomes draggable (for Kanban) */
  onDragStart?: () => void
}

export function LeadCard({ lead, onClick, onDragStart }: LeadCardProps) {
  const status = LEAD_STATUSES.find(s => s.id === lead.status) || LEAD_STATUSES[0]
  const isDraggable = onDragStart != null

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 hover:border-white/20 transition-all shadow-lg hover:shadow-xl ${
        isDraggable ? 'cursor-move' : 'cursor-pointer'
      }`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-white mb-1">
              {lead.name}
            </h4>
            {lead.city && (
              <p className="text-xs text-white/50">{lead.city}</p>
            )}
          </div>
          <span className={`${status.color} px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap`}>
            {status.label}
          </span>
        </div>
        
        <div className="text-sm" onClick={(e) => e.stopPropagation()}>
          <PhoneActions phone={lead.phone ?? ''} leadName={lead.name ?? undefined} variant="full" />
        </div>
        
        {lead.email && (
          <div className="text-xs text-white/60">
            ✉️ {lead.email}
          </div>
        )}
        
        {lead.source && (
          <div className="text-xs text-white/60">
            📍 {lead.source}
          </div>
        )}
        
        {lead.notes && (
          <div className="text-xs text-white/50 pt-2 border-t border-white/10 line-clamp-2">
            {lead.notes}
          </div>
        )}
        
        <div className="text-xs text-white/40 pt-1">
          {formatDate(lead.created_at)}
        </div>
      </div>
    </div>
  )
}

