'use client'

import { useCRMTranslations } from './useCRMTranslations'

export type KanbanGroupBy = 'status' | 'source'

interface GroupByToggleProps {
  groupBy: KanbanGroupBy
  onGroupByChange: (mode: KanbanGroupBy) => void
}

export function GroupByToggle({ groupBy, onGroupByChange }: GroupByToggleProps) {
  const t = useCRMTranslations()
  return (
    <div className="flex rounded-lg border border-white/20 bg-white/5 overflow-hidden">
      <button
        onClick={() => onGroupByChange('status')}
        className={`px-4 py-2 text-sm transition-colors ${
          groupBy === 'status'
            ? 'bg-purple-600 text-white'
            : 'bg-transparent hover:bg-white/10'
        }`}
      >
        {t.leads.groupByStatus}
      </button>
      <button
        onClick={() => onGroupByChange('source')}
        className={`px-4 py-2 text-sm transition-colors ${
          groupBy === 'source'
            ? 'bg-purple-600 text-white'
            : 'bg-transparent hover:bg-white/10'
        }`}
      >
        {t.leads.groupBySource}
      </button>
    </div>
  )
}
