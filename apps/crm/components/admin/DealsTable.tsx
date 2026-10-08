"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import { useTranslations } from 'next-intl'
import type { Deal } from './deal-types'
import { CreateDealModal } from './CreateDealModal'
import { DealsHeader } from './DealsHeader'
import { DealsStatus } from './DealsStatus'
import { KanbanBoard } from './KanbanBoard'
import { DealsTableView } from './DealsTableView'
import { formatCurrency, formatDate } from './deal-utils'
import { filterDeals } from './deal-filters'
import { useDeals, type DealsScope } from './hooks/useDeals'
import { useTeamNames } from './hooks/useTeamNames'
import { useCRMTranslations } from './useCRMTranslations'
import { useDealActions } from './hooks/useDealActions'
import { useDealDragDrop } from './hooks/useDealDragDrop'
import { useDealPaymentsMap } from './hooks/useDealPaymentsMap'
import { useDealLaborMap } from './hooks/useDealLaborMap'
import { useDealMaterialOrdersTotalsMap } from './hooks/useDealMaterialOrdersTotalsMap'
import { ModuleEmptyState } from '@/components/onboarding'

const DealModal = dynamic(
  () => import('./DealModal').then((mod) => ({ default: mod.DealModal })),
  { ssr: false, loading: () => null },
)

type ViewMode = 'kanban' | 'table'

export function DealsTable() {
  const tOnboarding = useTranslations('onboarding')
  const t = useCRMTranslations()
  const teamNames = useTeamNames()
  const [scope, setScope] = useState<DealsScope>('board')
  const [q, setQ] = useState("")
  const [stageFilter, setStageFilter] = useState("")
  const [projectTypeFilter, setProjectTypeFilter] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [page, setPage] = useState(0)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { deals, totalCount, quickOfferCount, loading, error, reload } = useDeals({
    scope,
    searchQuery: q,
    stageFilter,
    projectTypeFilter,
    page,
    limit: 500
  })

  const { create, patch, del } = useDealActions({
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

  const dealIds = deals.map((d) => d.id)
  const paymentsMap = useDealPaymentsMap(dealIds)
  const laborMap = useDealLaborMap(dealIds)
  const materialOrdersMap = useDealMaterialOrdersTotalsMap(dealIds)

  function handleScopeChange(next: DealsScope) {
    setScope(next)
    setPage(0)
  }

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
        scope={scope}
        quickOfferCount={quickOfferCount}
        onScopeChange={handleScopeChange}
        searchQuery={q}
        stageFilter={stageFilter}
        projectTypeFilter={projectTypeFilter}
        viewMode={viewMode}
        dealsCount={deals.length}
        totalCount={totalCount}
        onSearchChange={handleSearchChange}
        onStageFilterChange={handleStageFilterChange}
        onProjectTypeFilterChange={handleProjectTypeFilterChange}
        onViewModeChange={setViewMode}
        onAddNew={() => setShowCreateModal(true)}
        onShowStatistics={() => {}}
      />
      
      <DealsStatus loading={loading} error={error} />

      {scope === 'quick' && (
        <p className="mb-4 rounded-lg border border-dashed border-sky-400/30 bg-sky-500/5 px-4 py-3 text-sm text-sky-100/80">
          {t.deals.quickOfferHint}
        </p>
      )}

      {!loading && !error && deals.length === 0 && scope === 'board' && (
        <div className="mb-8">
          <ModuleEmptyState
            title={tOnboarding('emptyDealsTitle')}
            description={tOnboarding('emptyDealsDesc')}
            actionLabel={tOnboarding('emptyDealsCta')}
            onAction={() => setShowCreateModal(true)}
          />
        </div>
      )}

      {!loading && !error && deals.length === 0 && scope === 'board' ? null : viewMode === 'kanban' ? (
        <KanbanBoard
          deals={deals}
          memberNames={teamNames}
          paymentsMap={paymentsMap}
          laborMap={laborMap}
          materialOrdersMap={materialOrdersMap}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDealDragStart={handleDragStart}
          onDealClick={setSelectedDeal}
        />
      ) : (
        <DealsTableView
          deals={filteredRows}
          memberNames={teamNames}
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
            const result = await patch(selectedDeal.id, updates)
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
