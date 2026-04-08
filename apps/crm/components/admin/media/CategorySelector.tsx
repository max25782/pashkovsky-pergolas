'use client'

import { CATALOG_CATEGORIES } from '@/lib/media/catalog-categories'

export { CATALOG_CATEGORIES }

interface CategorySelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  label?: string
  noCategoryLabel?: string
  categoryLabels?: Record<string, string>
}

export function CategorySelector({ value, onChange, label, noCategoryLabel = 'No category', categoryLabels }: CategorySelectorProps) {
  return (
    <div>
      {label && <p className="text-sm text-white/70 mb-2">{label}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            value === null
              ? 'bg-amber-600/60 border-amber-500 text-white'
              : 'bg-white/5 border-white/20 text-white/60 hover:border-white/40 hover:text-white'
          }`}
        >
          {noCategoryLabel}
        </button>
        {CATALOG_CATEGORIES.map((c) => {
          const active = value === c.id
          const label = categoryLabels?.[c.id] ?? c.labelHe
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active
                  ? 'bg-green-600 border-green-500 text-white'
                  : 'bg-white/5 border-white/20 text-white/60 hover:border-white/40 hover:text-white'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
