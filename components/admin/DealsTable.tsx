"use client"
import { useState } from "react"
import type { Deal } from './deal-types'
import { DealModal } from './DealModal'
import { CreateDealModal } from './CreateDealModal'
import { DealsHeader } from './DealsHeader'
import { DealsStatus } from './DealsStatus'
import { DealsStatistics } from './DealsStatistics'
import { KanbanBoard } from './KanbanBoard'
import { DealsTableView } from './DealsTableView'
import { formatCurrency, formatDate } from './deal-utils'
import { filterDeals } from './deal-filters'
import { useDeals } from './hooks/useDeals'
import { useDealActions } from './hooks/useDealActions'
import { useDealDragDrop } from './hooks/useDealDragDrop'

interface Props {
  adminToken: string
}

type ViewMode = 'kanban' | 'table'

export function DealsTable({ adminToken }: Props) {
  const [q, setQ] = useState("")
  const [stageFilter, setStageFilter] = useState("")
  const [projectTypeFilter, setProjectTypeFilter] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [page, setPage] = useState(0)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showStatistics, setShowStatistics] = useState(false)

  const { deals, loading, error, reload } = useDeals({
    adminToken,
    searchQuery: q,
    stageFilter,
    projectTypeFilter,
    page,
    limit: 100
  })

  const { create, patch, del, creating, updating, deleting } = useDealActions({
    adminToken,
    onUpdate: async (updatedDeal) => {
      if (selectedDeal?.id === updatedDeal.id) {
        setSelectedDeal(updatedDeal)
      }
      await reload()
    },
    onDelete: async () => {
      if (selectedDeal) {
        setSelectedDeal(null)
      }
      await reload()
    }
  })

  const { handleDragStart, handleDragOver, handleDrop } = useDealDragDrop({
    onStageChange: async (dealId, newStage) => {
      await patch(dealId, { stage: newStage as any })
    }
  })

  const filteredRows = filterDeals(deals, {
    searchQuery: q,
    stageFilter,
    projectTypeFilter
  })

  function handleSearchChange(value: string) {
    setQ(value)
    setPage(0)
  }

  function handleStageFilterChange(value: string) {
    setStageFilter(value)
    setPage(0)
  }

  function handleProjectTypeFilterChange(value: string) {
    setProjectTypeFilter(value)
    setPage(0)
  }

  async function handleDealDelete(deal: Deal) {
    try {
      await del(deal.id)
      // Принудительно перезагружаем данные после удаления
      await reload()
    } catch (e) {
      // Ошибка уже обработана в del()
    }
  }

  return (
    <section className="p-4">
      <DealsHeader
        searchQuery={q}
        stageFilter={stageFilter}
        projectTypeFilter={projectTypeFilter}
        viewMode={viewMode}
        onSearchChange={handleSearchChange}
        onStageFilterChange={handleStageFilterChange}
        onProjectTypeFilterChange={handleProjectTypeFilterChange}
        onViewModeChange={setViewMode}
        onAddNew={() => setShowCreateModal(true)}
        onShowStatistics={() => setShowStatistics(!showStatistics)}
      />
      
      <DealsStatus loading={loading || updating || creating || deleting} error={error} />

      {showStatistics && (
        <div className="mb-6">
          <DealsStatistics deals={deals} key={deals.length} />
        </div>
      )}

      {viewMode === 'kanban' && (
        <KanbanBoard
          key={`kanban-${deals.length}-${deals.map(d => d.id).join(',')}`}
          deals={deals}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDealDragStart={handleDragStart}
          onDealClick={setSelectedDeal}
        />
      )}

      {viewMode === 'table' && (
        <DealsTableView
          deals={filteredRows}
          loading={loading}
          onDealClick={setSelectedDeal}
          onDealDelete={handleDealDelete}
        />
      )}

      {selectedDeal && (
        <DealModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onUpdate={async (updates) => {
            console.log('DealsTable onUpdate called with:', updates)
            const result = await patch(selectedDeal.id, updates)
            console.log('Patch result:', result)
            await reload()
            return result
          }}
          onDelete={async () => {
            await handleDealDelete(selectedDeal)
            setSelectedDeal(null)
          }}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}

      {showCreateModal && (
        <CreateDealModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (dealData) => {
            await create(dealData)
            setShowCreateModal(false)
            reload()
          }}
        />
      )}
    </section>
  )
}

// Re-export Deal type for backward compatibility
export type { Deal } from './deal-types'
