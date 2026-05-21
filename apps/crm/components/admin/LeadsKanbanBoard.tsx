import type { Lead } from './lead-types'
import { LEAD_STATUSES, LEAD_SOURCES, normalizeLeadSource, pickLabel } from './lead-types'
import { LeadsKanbanColumn } from './LeadsKanbanColumn'
import type { KanbanGroupBy } from './GroupByToggle'
import { useLanguage } from '@/lib/language-context'

interface LeadsKanbanBoardProps {
  leads: Lead[]
  groupBy: KanbanGroupBy
  onDragOver: (e: React.DragEvent) => void
  onDrop: (status: string) => void
  onLeadDragStart: (lead: Lead) => void
  onLeadClick: (lead: Lead) => void
}

export function LeadsKanbanBoard({
  leads,
  groupBy,
  onDragOver,
  onDrop,
  onLeadDragStart,
  onLeadClick
}: LeadsKanbanBoardProps) {
  const { language } = useLanguage()
  const isStatusGroup = groupBy === 'status'

  function getLeadsByStatus(statusId: string) {
    return leads.filter(lead => {
      const leadStatus = lead.status || 'waiting'
      return leadStatus === statusId
    })
  }

  function getLeadsBySource(sourceId: string) {
    return leads.filter(lead => normalizeLeadSource(lead.source) === sourceId)
  }

  const rawColumns = isStatusGroup ? LEAD_STATUSES : LEAD_SOURCES
  const columns = rawColumns.map(col => ({ ...col, label: pickLabel(col, language) }))

  return (
    <div className="overflow-x-auto pb-4 -mx-4 px-4">
      <div className="flex gap-4 min-w-max">
        {columns.map(col => {
          const columnLeads = isStatusGroup
            ? getLeadsByStatus(col.id)
            : getLeadsBySource(col.id)
          return (
            <LeadsKanbanColumn
              key={col.id}
              column={col}
              leads={columnLeads}
              draggable={isStatusGroup}
              onDragOver={onDragOver}
              onDrop={isStatusGroup ? () => onDrop(col.id) : undefined}
              onLeadDragStart={isStatusGroup ? onLeadDragStart : undefined}
              onLeadClick={onLeadClick}
            />
          )
        })}
      </div>
    </div>
  )
}
