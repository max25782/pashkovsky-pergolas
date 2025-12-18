import { getStages } from './deal-types'
import { useCRMTranslations } from './useCRMTranslations'

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
  const t = useCRMTranslations()
  const stages = getStages(t.deals)
  return (
    <>
      <select
        value={stageFilter}
        onChange={(e) => onStageFilterChange(e.target.value)}
        className="px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 focus:bg-white/10 focus:outline-none"
      >
        <option value="">{t.deals.filters.allStages}</option>
        {stages.map(s => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      <select
        value={projectTypeFilter}
        onChange={(e) => onProjectTypeFilterChange(e.target.value)}
        className="px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 focus:bg-white/10 focus:outline-none"
      >
        <option value="">{t.deals.filters.allTypes}</option>
        <option value="pergola">{t.deals.projectTypes.pergola}</option>
        <option value="railing">{t.deals.projectTypes.railing}</option>
        <option value="gates">{t.deals.projectTypes.gates}</option>
        <option value="windows">{t.deals.projectTypes.windows}</option>
        <option value="laundry_closet">{t.deals.projectTypes.laundry_closet}</option>
      </select>
    </>
  )
}

