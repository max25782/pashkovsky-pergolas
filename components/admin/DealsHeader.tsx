import { SearchBar } from './SearchBar'
import { DealsFilters } from './DealsFilters'
import { ViewToggle } from './ViewToggle'

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
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="🔍 Поиск по имени, телефону, материалу, RAL..."
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
            <button
              onClick={onShowStatistics}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
            >
              📊 Статистика
            </button>
          )}
          {onAddNew && (
            <button
              onClick={onAddNew}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              ➕ Новая сделка
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

