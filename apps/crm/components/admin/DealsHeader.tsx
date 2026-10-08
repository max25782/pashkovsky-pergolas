import { SearchBar } from './SearchBar'
import { DealsFilters } from './DealsFilters'
import { ViewToggle } from './ViewToggle'
import { useCRMTranslations } from './useCRMTranslations'
import Link from 'next/link'

import type { DealsScope } from './hooks/useDeals'

type ViewMode = 'kanban' | 'table'

interface DealsHeaderProps {
  scope: DealsScope
  quickOfferCount: number
  onScopeChange: (scope: DealsScope) => void
  searchQuery: string
  stageFilter: string
  projectTypeFilter: string
  viewMode: ViewMode
  dealsCount?: number
  totalCount?: number | null
  onSearchChange: (value: string) => void
  onStageFilterChange: (value: string) => void
  onProjectTypeFilterChange: (value: string) => void
  onViewModeChange: (mode: ViewMode) => void
  onAddNew?: () => void
  onShowStatistics?: () => void
}

export function DealsHeader({
  scope,
  quickOfferCount,
  onScopeChange,
  searchQuery,
  stageFilter,
  projectTypeFilter,
  viewMode,
  dealsCount = 0,
  totalCount,
  onSearchChange,
  onStageFilterChange,
  onProjectTypeFilterChange,
  onViewModeChange,
  onAddNew,
  onShowStatistics
}: DealsHeaderProps) {
  const t = useCRMTranslations()
  
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'board'}
          onClick={() => onScopeChange('board')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            scope === 'board'
              ? 'bg-white/15 text-white'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          }`}
        >
          {t.deals.scopeSaved}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'quick'}
          onClick={() => onScopeChange('quick')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-dashed ${
            scope === 'quick'
              ? 'bg-sky-500/25 border-sky-400/60 text-sky-100'
              : 'bg-sky-500/5 border-sky-400/30 text-sky-200/70 hover:bg-sky-500/15'
          }`}
        >
          {t.deals.scopeQuickOffers}
          <span className="ms-2 rounded-full bg-sky-400/30 px-2 py-0.5 text-xs">
            {quickOfferCount}
          </span>
        </button>
      </div>
      {totalCount !== null && totalCount !== undefined && totalCount > 0 && (
        <div className="text-sm text-white/60">
          {totalCount > 500 ? `${dealsCount} / ${totalCount}` : totalCount}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t.deals.searchPlaceholder}
          />
          <DealsFilters
            stageFilter={stageFilter}
            projectTypeFilter={projectTypeFilter}
            onStageFilterChange={onStageFilterChange}
            onProjectTypeFilterChange={onProjectTypeFilterChange}
          />
        </div>
        <div className="flex items-center gap-2">
          {onShowStatistics && (
            <Link
              href="/app/admin/statistics"
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
            >
              📊 {t.deals.statistics}
            </Link>
          )}
          {onAddNew && (
            <button
              onClick={onAddNew}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              ➕ {t.deals.newDeal}
            </button>
          )}
          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
          />
        </div>
      </div>
    </div>
  )
}

