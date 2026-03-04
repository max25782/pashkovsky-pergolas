'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, FormEvent, useEffect } from 'react'
import { type Locale } from '@/lib/locales'
import { Search, X } from 'lucide-react'

interface SearchBarProps {
  locale: Locale
  wide?: boolean
}

export function SearchBar({ locale, wide }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')

  useEffect(() => {
    setSearch(searchParams.get('search') || '')
  }, [searchParams])

  const commit = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value.trim()) {
      params.set('search', value.trim())
    } else {
      params.delete('search')
    }
    router.push(`/${locale}?${params.toString()}`)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    commit(search)
  }

  const handleClear = () => {
    setSearch('')
    commit('')
  }

  if (wide) {
    return (
      <form onSubmit={handleSubmit} className="w-full">
        <div className="relative flex items-center">
          <Search className="absolute right-4 w-5 h-5 text-white/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={locale === 'he' ? '🔎 חפש פרופיל (לדוגמה: 60x40, גדר, פרגולה...)' : locale === 'ru' ? '🔎 Поиск профиля (например: 60x40, забор, перголы...)' : '🔎 Search profile (e.g. 60x40, fence, pergola...)'}
            dir="rtl"
            className="w-full pr-12 pl-12 py-3.5 bg-white/10 border-2 border-white/20 hover:border-white/40 focus:border-white/60 rounded-xl text-white text-base placeholder:text-white/40 focus:outline-none transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute left-4 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute right-3 w-4 h-4 text-white/50 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={locale === 'he' ? 'חיפוש...' : locale === 'ru' ? 'Поиск...' : 'Search...'}
          className="w-full pr-9 pl-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        />
      </div>
    </form>
  )
}
