import type { Lead } from './lead-types'
import { LeadCard } from './LeadCard'
import { useCRMTranslations } from './useCRMTranslations'

interface LeadsKanbanColumnProps {
  column: { id: string; label: string; color: string }
  leads: Lead[]
  draggable: boolean
  onDragOver: (e: React.DragEvent) => void
  onDrop?: () => void
  onLeadDragStart?: (lead: Lead) => void
  onLeadClick: (lead: Lead) => void
}

export function LeadsKanbanColumn({
  column,
  leads,
  draggable,
  onDragOver,
  onDrop,
  onLeadDragStart,
  onLeadClick
}: LeadsKanbanColumnProps) {
  const t = useCRMTranslations()
  return (
    <div
      className="flex-shrink-0 w-[92vw] min-w-[92vw] sm:w-80 sm:min-w-[320px]"
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={
        draggable && onDrop
          ? (e) => {
              e.preventDefault()
              onDrop()
            }
          : undefined
      }
    >
      <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
        <div className={`${column.color} px-4 py-3 flex items-center justify-between`}>
          <h3 className="font-semibold text-white">
            {column.label}
          </h3>
          <span className="bg-white/20 px-2 py-1 rounded text-sm font-medium">
            {leads.length}
          </span>
        </div>
        <div className="p-3 space-y-3 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onDragStart={draggable && onLeadDragStart ? () => onLeadDragStart(lead) : undefined}
              onClick={() => onLeadClick(lead)}
            />
          ))}
          {leads.length === 0 && (
            <div className="text-center text-white/30 py-8 text-sm">
              {t.status.noLeads}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
