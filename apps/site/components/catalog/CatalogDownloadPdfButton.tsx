'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

export function CatalogDownloadPdfButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/catalog/pdf')
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(j?.error ?? `PDF failed (${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'pashkovsky-catalog.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בהורדה')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={isLoading}
        className="no-print inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-neutral-800 disabled:opacity-60"
      >
        <Download className="h-4 w-4" aria-hidden />
        {isLoading ? 'מייצר PDF…' : 'הורדת קטלוג PDF'}
      </button>
      {error ? <p className="text-right text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
