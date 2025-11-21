import { STAGES } from './deal-types'

interface DealsFiltersProps {
  stageFilter: string
  projectTypeFilter: string
  onStageFilterChange: (value: string) => void
  onProjectTypeFilterChange: (value: string) => void
}

export function DealsFilters({
  stageFilter,
  projectTypeFilter,
  onStageFilterChange,
  onProjectTypeFilterChange
}: DealsFiltersProps) {
  return (
    <>
      <select
        value={stageFilter}
        onChange={(e) => onStageFilterChange(e.target.value)}
        className="px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 focus:bg-white/10 focus:outline-none"
      >
        <option value="">Все этапы</option>
        {STAGES.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <select
        value={projectTypeFilter}
        onChange={(e) => onProjectTypeFilterChange(e.target.value)}
        className="px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 focus:bg-white/10 focus:outline-none"
      >
        <option value="">Все типы</option>
        <option value="pergola">Пергола</option>
        <option value="railing">Перила</option>
        <option value="gates">Ворота</option>
        <option value="windows">Окна</option>
      </select>
    </>
  )
}

