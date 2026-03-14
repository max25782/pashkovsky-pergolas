'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { SearchBar } from './SearchBar'
import { useCRMTranslations } from './useCRMTranslations'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'

interface LeadsHeaderProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  onPageChange: (page: number) => void
  currentPage: number
  onImportComplete?: () => void
}

export function LeadsHeader({
  searchQuery,
  onSearchChange,
  onPageChange,
  currentPage,
  onImportComplete
}: LeadsHeaderProps) {
  const t = useCRMTranslations()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('source', 'facebook')
      const res = await authFetch('/admin-api/leads/import', {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || t.leads.importError)
        return
      }
      toast.success(t.leads.importSuccess(data.imported ?? 0))
      onImportComplete?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.leads.importError)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="mb-6 space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
        disabled={importing}
      />
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder={t.leads.searchPlaceholder}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {t.leads.import}
          </button>
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

