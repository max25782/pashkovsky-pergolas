type ViewMode = 'kanban' | 'table'

interface ViewToggleProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex rounded-lg border border-white/20 bg-white/5 overflow-hidden">
      <button
        onClick={() => onViewModeChange('kanban')}
        className={`px-4 py-2 transition-colors ${
          viewMode === 'kanban' 
            ? 'bg-blue-600 text-white' 
            : 'bg-transparent hover:bg-white/10'
        }`}
      >
        📋 Канбан
      </button>
      <button
        onClick={() => onViewModeChange('table')}
        className={`px-4 py-2 transition-colors ${
          viewMode === 'table' 
            ? 'bg-blue-600 text-white' 
            : 'bg-transparent hover:bg-white/10'
        }`}
      >
        📊 Таблица
      </button>
    </div>
  )
}

