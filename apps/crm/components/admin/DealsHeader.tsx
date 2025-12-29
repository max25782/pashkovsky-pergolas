import { SearchBar } from './SearchBar'
import { DealsFilters } from './DealsFilters'
import { ViewToggle } from './ViewToggle'
import { useCRMTranslations } from './useCRMTranslations'
import Link from 'next/link'

type ViewMode = 'kanban' | 'table'

interface DealsHeaderProps {
  searchQuery: string
  stageFilter: string
  projectTypeFilter: string
  viewMode: ViewMode
  onSearchChange: (value: string) => void
  onStageFilterChange: (value: string) => void
  onProjectTypeFilterChange: (value: string) => void
  onViewModeChange: (mode: ViewMode) => void
  onAddNew?: () => void
  onShowStatistics?: () => void
}

export function DealsHeader({
  searchQuery,
  stageFilter,
  projectTypeFilter,
  viewMode,
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

