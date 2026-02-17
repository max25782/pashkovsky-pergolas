'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { getTranslation, type Locale } from '@/lib/locales'
import { cn } from '@/lib/cn'

interface FilterPanelProps {
  locale: Locale
}

const categories = [
  { value: 'all', label: { he: 'כל המוצרים', ru: 'Все товары', en: 'All Products' } },
  { value: 'pergulas', label: { he: 'פרגולות', ru: 'Перголы', en: 'Pergolas' } },
  { value: 'structural', label: { he: 'מבני', ru: 'Конструкционные', en: 'Structural' } },
  { value: 'lighting', label: { he: 'תאורה', ru: 'Освещение', en: 'Lighting' } },
  { value: 'decorative', label: { he: 'דקורטיבי', ru: 'Декоративные', en: 'Decorative' } },
  { value: 'railings', label: { he: 'מעקות', ru: 'Перила', en: 'Railings' } },
]

export function FilterPanel({ locale }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedCategory = searchParams.get('category') || 'all'

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (category === 'all') {
      params.delete('category')
    } else {
      params.set('category', category)
    }
    router.push(`/${locale}?${params.toString()}`)
  }

  return (
    <aside className="w-64 space-y-4">
      <h3 className="text-lg font-semibold text-white">Categories</h3>
      <div className="space-y-2">
        {categories.map((category) => (
          <button
            key={category.value}
            onClick={() => handleCategoryChange(category.value)}
            className={cn(
              'w-full text-left px-4 py-2 rounded-lg transition-colors',
              selectedCategory === category.value
                ? 'bg-primary text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            )}
          >
            {category.label[locale] || category.label.en}
          </button>
        ))}
      </div>
    </aside>
  )
}
