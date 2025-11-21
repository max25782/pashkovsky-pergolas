"use client"
import { useState } from "react"
import type { Lead } from './lead-types'
import { LeadModal } from './LeadModal'
import { LeadsHeader } from './LeadsHeader'
import { LeadsTableView } from './LeadsTableView'
import { DealsStatus } from './DealsStatus'
import { useLeads } from './hooks/useLeads'
import { useLeadActions } from './hooks/useLeadActions'

interface Props {
  adminToken: string
}

export function LeadsTable({ adminToken }: Props) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const limit = 20

  const { leads, loading, error, reload } = useLeads({
    adminToken,
    searchQuery: q,
    page,
    limit
  })

  const { patch, del, updating } = useLeadActions({
    adminToken,
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

  return (
    <section className="p-4">
      <LeadsHeader
        searchQuery={q}
        onSearchChange={handleSearchChange}
        onPageChange={setPage}
        currentPage={page}
      />
      
      <DealsStatus loading={loading || updating} error={error} />

      <LeadsTableView
        leads={leads}
        loading={loading}
        onLeadClick={setSelectedLead}
        onLeadDelete={handleLeadDelete}
        onStatusChange={handleStatusChange}
        onNotesChange={handleNotesChange}
      />

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
