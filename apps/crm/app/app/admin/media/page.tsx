'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { RefreshCw, Download, Search, CheckSquare, Square, AlertCircle, Pencil } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'
import {
  CategorySelector,
  CATALOG_CATEGORIES,
} from '@/components/admin/media/CategorySelector'

// ─── Types ───────────────────────────────────────────────────────────────────

interface S3Item {
  key: string
  size: number
  lastModified: string
  mimeType: string
}

interface AssetRow {
  s3_key: string
  caption: string | null
  category: string | null
  presignedUrl?: string
}

interface DisplayItem extends S3Item {
  caption: string | null
  category: string | null
  presignedUrl: string
  indexed: boolean
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MediaAdminPage() {
  const [prefix, setPrefix] = useState('images/')
  const [prefixInput, setPrefixInput] = useState('images/')
  const [showUncategorizedFirst, setShowUncategorizedFirst] = useState(true)

  const [s3Items, setS3Items] = useState<S3Item[]>([])
  const [dbAssets, setDbAssets] = useState<Map<string, AssetRow>>(new Map())
  const [displayItems, setDisplayItems] = useState<DisplayItem[]>([])

  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [nextToken, setNextToken] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const [presignedUrls, setPresignedUrls] = useState<Record<string, string>>({})

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState<string | null>(null)
  const [applyingBulk, setApplyingBulk] = useState(false)

  const [editKey, setEditKey] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const loadS3 = useCallback(async (token?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ prefix })
      if (token) params.set('token', token)

      const res = await authFetch(`/api/media/s3/list?${params}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to list S3 objects')
      }
      const data: { items: S3Item[]; nextToken?: string } = await res.json()

      setS3Items((prev) => (token ? [...prev, ...data.items] : data.items))
      setNextToken(data.nextToken)
      setHasMore(!!data.nextToken)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [prefix])

  const loadDbForPrefix = useCallback(async () => {
    try {
      const res = await authFetch(`/api/media/db/list?prefix=${encodeURIComponent(prefix)}`)
      if (!res.ok) return
      const data: {
        assets: Array<{ s3_key: string; caption: string | null; category?: string | null }>
      } = await res.json()
      const map = new Map<string, AssetRow>()
      for (const row of data.assets) {
        map.set(row.s3_key, {
          s3_key: row.s3_key,
          caption: row.caption,
          category: row.category ?? null,
        })
      }
      setDbAssets(map)
    } catch (e) {
      console.error('[Media] Failed to load DB assets:', e)
    }
  }, [prefix])

  useEffect(() => {
    const merged: DisplayItem[] = s3Items.map((item) => {
      const db = dbAssets.get(item.key)
      return {
        ...item,
        caption: db?.caption ?? null,
        category: db?.category ?? null,
        presignedUrl: presignedUrls[item.key] ?? db?.presignedUrl ?? '',
        indexed: !!db,
      }
    })

    if (showUncategorizedFirst) {
      merged.sort((a, b) => {
        const aHas = a.category != null ? 1 : 0
        const bHas = b.category != null ? 1 : 0
        return aHas - bHas
      })
    }

    setDisplayItems(merged)
  }, [s3Items, dbAssets, showUncategorizedFirst, presignedUrls])

  useEffect(() => {
    setPresignedUrls({})
    setDbAssets(new Map())
    setS3Items([])
    void loadS3()
    void loadDbForPrefix()
  }, [prefix, loadS3, loadDbForPrefix])

  const presignBatchKey = useMemo(
    () =>
      displayItems
        .filter((i) => !i.presignedUrl && i.mimeType.startsWith('image/'))
        .slice(0, 30)
        .map((i) => i.key)
        .join('\0'),
    [displayItems],
  )

  useEffect(() => {
    if (!presignBatchKey) return

    const keys = presignBatchKey.split('\0').filter(Boolean)
    if (keys.length === 0) return

    ;(async () => {
      try {
        const res = await authFetch('/api/media/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys }),
        })
        if (!res.ok) return
        const data: { urls: Record<string, string> } = await res.json()
        setPresignedUrls((prev) => ({ ...prev, ...data.urls }))
      } catch (e) {
        console.error('[Media] Presign batch failed:', e)
      }
    })()
  }, [presignBatchKey])

  async function handleImport() {
    if (!s3Items.length) {
      setError('Load S3 items first')
      return
    }
    setImporting(true)
    setError(null)
    setMessage(null)
    let imported = 0
    const skipped: string[] = []

    for (const item of s3Items) {
      if (dbAssets.has(item.key)) {
        skipped.push(item.key)
        continue
      }
      try {
        const res = await authFetch('/api/media/tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: item.key }),
        })
        if (res.ok) {
          imported++
          setDbAssets((prev) => {
            const next = new Map(prev)
            next.set(item.key, { s3_key: item.key, caption: null, category: null })
            return next
          })
        }
      } catch {
        /* continue */
      }
    }

    setImporting(false)
    setMessage(`Imported ${imported} new items (${skipped.length} already indexed)`)
  }

  async function handleSaveCategory(key: string, category: string | null) {
    setSavingKey(key)
    setError(null)
    try {
      const caption = dbAssets.get(key)?.caption ?? null
      const res = await authFetch('/api/media/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, caption, category }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Save failed')
      }
      setDbAssets((prev) => {
        const next = new Map(prev)
        next.set(key, { s3_key: key, caption: prev.get(key)?.caption ?? null, category })
        return next
      })
      setEditKey(null)
      setMessage(`Saved catalog category for ${key.split('/').pop()}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingKey(null)
    }
  }

  async function handleBulkApplyCategory() {
    if (!selected.size || bulkCategory == null) return
    setApplyingBulk(true)
    setError(null)
    let saved = 0
    for (const key of selected) {
      try {
        const prevRow = dbAssets.get(key)
        const res = await authFetch('/api/media/tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            caption: prevRow?.caption ?? null,
            category: bulkCategory,
          }),
        })
        if (res.ok) {
          saved++
          setDbAssets((prev) => {
            const next = new Map(prev)
            const row = prev.get(key)
            next.set(key, {
              s3_key: key,
              caption: row?.caption ?? null,
              category: bulkCategory,
            })
            return next
          })
        }
      } catch {
        /* continue */
      }
    }
    setApplyingBulk(false)
    setSelected(new Set())
    setMessage(`Applied category to ${saved} items`)
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(displayItems.map((i) => i.key)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול מדיה לבינה מלאכותית</h1>
          <p className="text-white/50 text-sm mt-1">
            קבע קטגוריית קטלוג לכל תמונה (ללא תגיות). הקטלוג הציבורי מבוסס תיקיות S3.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 flex gap-2 min-w-[200px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPrefix(prefixInput)
                  setS3Items([])
                }
              }}
              placeholder="S3 prefix, e.g. images/pergulot/"
              className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/20 rounded text-white placeholder-white/30 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPrefix(prefixInput)
              setS3Items([])
            }}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm font-medium"
          >
            חפש
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={showUncategorizedFirst}
            onChange={(e) => setShowUncategorizedFirst(e.target.checked)}
            className="accent-blue-500"
          />
          ללא קטגוריית קטלוג קודם
        </label>

        <button
          type="button"
          onClick={handleImport}
          disabled={importing || !s3Items.length}
          className="flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          {importing ? 'מייבא...' : 'ייבא מ-S3'}
        </button>

        <button
          type="button"
          onClick={() => void loadS3()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          רענן
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-200">{selected.size} פריטים נבחרו</span>
            <button type="button" onClick={clearSelection} className="text-xs text-white/50 hover:text-white">
              בטל בחירה
            </button>
          </div>
          <CategorySelector
            value={bulkCategory}
            onChange={setBulkCategory}
            label="קטגוריית קטלוג לכל הפריטים הנבחרים"
          />
          <button
            type="button"
            onClick={() => void handleBulkApplyCategory()}
            disabled={applyingBulk || bulkCategory == null}
            className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {applyingBulk ? 'שומר...' : `החל קטגוריה על ${selected.size} פריטים`}
          </button>
        </div>
      )}

      {message && (
        <div className="bg-green-500/20 border border-green-500/40 rounded p-3 text-green-300 text-sm mb-4">
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded p-3 text-red-300 text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {displayItems.length > 0 && (
        <div className="flex items-center gap-4 mb-3 text-sm text-white/60">
          <button type="button" onClick={selectAll} className="hover:text-white flex items-center gap-1">
            <CheckSquare className="w-4 h-4" /> בחר הכל ({displayItems.length})
          </button>
          <span>•</span>
          <span>{displayItems.filter((i) => i.category != null).length} עם קטגוריית קטלוג</span>
          <span>•</span>
          <span>{displayItems.filter((i) => i.category == null).length} ללא קטגוריה</span>
        </div>
      )}

      {loading && !displayItems.length && (
        <div className="text-center py-16 text-white/50">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>טוען תמונות מ-S3...</p>
        </div>
      )}

      {!loading && displayItems.length === 0 && (
        <div className="text-center py-16 text-white/50">
          <p className="text-lg mb-2">לא נמצאו קבצים</p>
          <p className="text-sm">נסה prefix אחר (לדוגמה: images/pergulot/)</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {displayItems.map((item) => {
          const filename = item.key.split('/').pop() ?? item.key
          const isSelected = selected.has(item.key)
          const isEditing = editKey === item.key
          const isSaving = savingKey === item.key

          return (
            <div
              key={item.key}
              className={`group relative bg-black/30 rounded-lg border overflow-hidden transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/40'
                  : item.category != null
                    ? 'border-green-500/30'
                    : 'border-white/10 hover:border-white/30'
              }`}
            >
              <div className="aspect-square relative bg-black/20">
                {item.presignedUrl ? (
                  <Image
                    src={item.presignedUrl}
                    alt={filename}
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="200px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
                    {item.mimeType.startsWith('image/') ? '🖼' : '🎥'} {filename.slice(0, 12)}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleSelect(item.key)}
                  className="absolute top-2 left-2 z-10 p-1 rounded bg-black/60 hover:bg-black/80 transition"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4 text-white/50" />
                  )}
                </button>

                {item.indexed && (
                  <span className="absolute top-2 right-2 bg-green-600/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                    DB
                  </span>
                )}
              </div>

              <div className="p-2 space-y-1.5">
                <p className="text-xs text-white/60 truncate" title={item.key}>
                  {filename}
                </p>

                {item.category != null && !isEditing && (
                  <span className="text-[10px] bg-green-600/50 text-green-200 px-1.5 py-0.5 rounded-full">
                    {CATALOG_CATEGORIES.find((c) => c.id === item.category)?.labelHe ?? item.category}
                  </span>
                )}

                {isEditing ? (
                  <div className="space-y-2">
                    <CategorySelector
                      value={editCategory}
                      onChange={setEditCategory}
                      label="קטלוג:"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => void handleSaveCategory(item.key, editCategory)}
                        disabled={isSaving}
                        className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs"
                      >
                        {isSaving ? '...' : 'שמור'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditKey(null)}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditKey(item.key)
                      setEditCategory(item.category)
                    }}
                    className="w-full py-1 rounded bg-white/5 hover:bg-white/15 text-xs text-white/60 hover:text-white transition-all flex items-center justify-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    {item.category != null ? 'ערוך קטגוריה' : 'הוסף קטגוריית קטלוג'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => void loadS3(nextToken)}
            disabled={loading}
            className="px-6 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm"
          >
            {loading ? 'טוען...' : 'טען עוד'}
          </button>
        </div>
      )}
    </main>
  )
}
