import { SearchBar } from './SearchBar'
import { useCRMTranslations } from './useCRMTranslations'

interface LeadsHeaderProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  currentPage: number
}

export function LeadsHeader({
  searchQuery,
  onSearchChange,
  onPageChange,
  currentPage
}: LeadsHeaderProps) {
  const t = useCRMTranslations()
  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t.leads.searchPlaceholder}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            ← {t.common.back}
          </button>
          <span className="px-4 py-2 text-white/70 text-sm">
            {t.leads.page} {currentPage + 1}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {t.common.next} →
          </button>
        </div>
      </div>
    </div>
  )
}

