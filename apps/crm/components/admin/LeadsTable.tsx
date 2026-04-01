"use client"
import { useState } from "react"
import type { Lead } from './lead-types'
import { LeadModal } from './LeadModal'
import { LeadsHeader } from './LeadsHeader'
import { LeadsKanbanBoard } from './LeadsKanbanBoard'
import { LeadsTableView } from './LeadsTableView'
import type { KanbanGroupBy } from './GroupByToggle'
import { DealsStatus } from './DealsStatus'
import { useLeads } from './hooks/useLeads'
import { useLeadActions } from './hooks/useLeadActions'
import { useLeadDragDrop } from './hooks/useLeadDragDrop'

type ViewMode = 'kanban' | 'table'

export function LeadsTable() {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [kanbanGroupBy, setKanbanGroupBy] = useState<KanbanGroupBy>('status')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const limit = viewMode === 'kanban' ? 500 : 20
  const effectivePage = viewMode === 'kanban' ? 0 : page

  const { leads, loading, error, reload } = useLeads({
    searchQuery: q,
    page: effectivePage,
    limit
  })

  const { patch, del } = useLeadActions({
    onUpdate: (updatedLead) => {
      if (selectedLead?.id === updatedLead.id) {
        setSelectedLead(updatedLead)
      }
      reload()
    },
    onDelete: () => {
      if (selectedLead) {
        setSelectedLead(null)
      }
      reload()
    }
  })

  function handleSearchChange(value: string) {
    setQ(value)
    setPage(0)
  }

  function handleStatusChange(lead: Lead, newStatus: string | null) {
    patch(lead.id, { status: newStatus as any })
  }

  function handleNotesChange(lead: Lead, notes: string | null) {
    patch(lead.id, { notes })
  }

  function handleLeadDelete(lead: Lead) {
    del(lead.id)
  }

  const { handleDragOver, handleDrop, handleDragStart } = useLeadDragDrop({
    onStatusChange: async (leadId, newStatus) => {
      await patch(leadId, { status: newStatus as Lead['status'] })
    }
  })

  return (
    <section className="p-4">
      <LeadsHeader
        searchQuery={q}
        onSearchChange={handleSearchChange}
        onPageChange={setPage}
        currentPage={page}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        kanbanGroupBy={kanbanGroupBy}
        onKanbanGroupByChange={setKanbanGroupBy}
        onImportComplete={reload}
      />
      
      <DealsStatus loading={loading} error={error} />

      {viewMode === 'kanban' && (
        <LeadsKanbanBoard
          key={kanbanGroupBy}
          leads={leads}
          groupBy={kanbanGroupBy}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onLeadDragStart={handleDragStart}
          onLeadClick={setSelectedLead}
        />
      )}

      {viewMode === 'table' && (
        <LeadsTableView
          leads={leads}
          loading={loading}
          onLeadClick={setSelectedLead}
          onLeadDelete={handleLeadDelete}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
        />
      )}

      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(updates) => patch(selectedLead.id, updates)}
          onDelete={() => {
            handleLeadDelete(selectedLead)
            setSelectedLead(null)
          }}
        />
      )}
    </section>
  )
}

// Re-export Lead type for backward compatibility
export type { Lead } from './lead-types'
