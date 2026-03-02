'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { RefreshCw, Download, Tag, Search, CheckSquare, Square, AlertCircle } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'
import { TagSelector, MEDIA_TAGS } from '@/components/admin/media/TagSelector'

// ─── Types ───────────────────────────────────────────────────────────────────

interface S3Item {
  key: string
  size: number
  lastModified: string
  mimeType: string
}

interface AssetRow {
  s3_key: string
  tags: string[]
  caption: string | null
  presignedUrl?: string   // loaded lazily per visible item
}

// Union: items from S3 list merged with DB rows
interface DisplayItem extends S3Item {
  tags: string[]
  caption: string | null
  presignedUrl: string
  indexed: boolean       // true = exists in media_assets DB
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MediaAdminPage() {
  const [prefix, setPrefix] = useState('images/')
  const [prefixInput, setPrefixInput] = useState('images/')
  const [showUntaggedFirst, setShowUntaggedFirst] = useState(true)

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

  // Selection & bulk-tag state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTags, setBulkTags] = useState<string[]>([])
  const [applyingBulk, setApplyingBulk] = useState(false)

  // Per-item editing
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // ── Load DB assets for current prefix ──────────────────────────────────────
  const loadDbAssets = useCallback(async () => {
    try {
      const res = await authFetch(`/api/media/s3/list?prefix=${encodeURIComponent(prefix)}`)
      if (!res.ok) return
      // We only have s3/list endpoint — db assets are loaded during import
      // For the initial view, just show S3 items; db rows are fetched below
    } catch { /* ignore */ }
  }, [prefix])

  // ── Load S3 list ───────────────────────────────────────────────────────────
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

      const newItems = token ? [...s3Items, ...data.items] : data.items
      setS3Items(newItems)
      setNextToken(data.nextToken)
      setHasMore(!!data.nextToken)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [prefix, s3Items])

  // ── Load DB assets (query with all tags = wildcard via empty query workaround) ─
  const loadDbForPrefix = useCallback(async () => {
    // Query each tag group individually is expensive;
    // Instead we use an internal list endpoint to get all indexed assets for prefix.
    // We call /api/media/query with each tag, but simpler: just import to get db rows.
    // For now, the display merges s3 list with known db state (updated on save).
  }, [])

  // ── Merge S3 + DB into display list ───────────────────────────────────────
  useEffect(() => {
    const merged: DisplayItem[] = s3Items.map((item) => {
      const db = dbAssets.get(item.key)
      return {
        ...item,
        tags: db?.tags ?? [],
        caption: db?.caption ?? null,
        presignedUrl: presignedUrls[item.key] ?? db?.presignedUrl ?? '',
        indexed: !!db,
      }
    })

    if (showUntaggedFirst) {
      merged.sort((a, b) => {
        const aTagged = a.tags.length > 0 ? 1 : 0
        const bTagged = b.tags.length > 0 ? 1 : 0
        return aTagged - bTagged
      })
    }

    setDisplayItems(merged)
  }, [s3Items, dbAssets, showUntaggedFirst, presignedUrls])

  // Initial load
  useEffect(() => {
    setPresignedUrls({})
    loadS3()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix])

  // ── Presign thumbnails lazily in batches of 30 ───────────────────────────
  useEffect(() => {
    const unresolved = displayItems
      .filter((i) => !i.presignedUrl && i.mimeType.startsWith('image/'))
      .slice(0, 30)

    if (unresolved.length === 0) return

    ;(async () => {
      try {
        const res = await authFetch('/api/media/presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: unresolved.map((i) => i.key) }),
        })
        if (!res.ok) return
        const data: { urls: Record<string, string> } = await res.json()

        setS3Items((prev) =>
          prev.map((item) =>
            data.urls[item.key]
              ? { ...item, _presignedUrl: data.urls[item.key] }
              : item,
          ),
        )
        // Store presigned URLs in a separate state so they survive re-renders
        setPresignedUrls((prev) => ({ ...prev, ...data.urls }))
      } catch (e) {
        console.error('[Media] Presign batch failed:', e)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayItems.length])

  // ── Import from S3 ─────────────────────────────────────────────────────────
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
      if (dbAssets.has(item.key)) { skipped.push(item.key); continue }
      try {
        const res = await authFetch('/api/media/tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: item.key, tags: [] }),
        })
        if (res.ok) {
          imported++
          setDbAssets((prev) => {
            const next = new Map(prev)
            next.set(item.key, { s3_key: item.key, tags: [], caption: null })
            return next
          })
        }
      } catch { /* continue */ }
    }

    setImporting(false)
    setMessage(`Imported ${imported} new items (${skipped.length} already indexed)`)
  }

  // ── Save tags for a single item ────────────────────────────────────────────
  async function handleSaveTags(key: string, tags: string[]) {
    setSavingKey(key)
    setError(null)
    try {
      const res = await authFetch('/api/media/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, tags }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Save failed')
      }
      setDbAssets((prev) => {
        const next = new Map(prev)
        next.set(key, { s3_key: key, tags, caption: prev.get(key)?.caption ?? null })
        return next
      })
      setEditKey(null)
      setMessage(`Saved tags for ${key.split('/').pop()}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingKey(null)
    }
  }

  // ── Bulk apply tags ────────────────────────────────────────────────────────
  async function handleBulkApply() {
    if (!selected.size || !bulkTags.length) return
    setApplyingBulk(true)
    setError(null)
    let saved = 0
    for (const key of selected) {
      try {
        const existing = dbAssets.get(key)?.tags ?? []
        const merged = Array.from(new Set([...existing, ...bulkTags]))
        const res = await authFetch('/api/media/tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, tags: merged }),
        })
        if (res.ok) {
          saved++
          setDbAssets((prev) => {
            const next = new Map(prev)
            next.set(key, { s3_key: key, tags: merged, caption: prev.get(key)?.caption ?? null })
            return next
          })
        }
      } catch { /* continue */ }
    }
    setApplyingBulk(false)
    setSelected(new Set())
    setMessage(`Applied tags to ${saved} items`)
  }

  // ── Toggle selection ───────────────────────────────────────────────────────
  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(displayItems.map((i) => i.key)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">ניהול מדיה לבינה מלאכותית</h1>
          <p className="text-white/50 text-sm mt-1">תייג תמונות S3 כך שה-AI יוכל להחזיר אותן לפי קטגוריה</p>
        </div>
      </div>

      {/* Prefix filter */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={prefixInput}
              onChange={(e) => setPrefixInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPrefix(prefixInput); setS3Items([]) } }}
              placeholder="S3 prefix, e.g. images/pergulot/"
              className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/20 rounded text-white placeholder-white/30 text-sm"
            />
          </div>
          <button
            onClick={() => { setPrefix(prefixInput); setS3Items([]); }}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-sm font-medium"
          >
            חפש
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
          <input
            type="checkbox"
            checked={showUntaggedFirst}
            onChange={(e) => setShowUntaggedFirst(e.target.checked)}
            className="accent-blue-500"
          />
          ללא תגיות קודם
        </label>

        <button
          onClick={handleImport}
          disabled={importing || !s3Items.length}
          className="flex items-center gap-2 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          {importing ? 'מייבא...' : 'ייבא מ-S3'}
        </button>

        <button
          onClick={() => loadS3()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          רענן
        </button>
      </div>

      {/* Bulk tag panel */}
      {selected.size > 0 && (
        <div className="bg-blue-900/30 border border-blue-500/40 rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-200">
              {selected.size} פריטים נבחרו
            </span>
            <button onClick={clearSelection} className="text-xs text-white/50 hover:text-white">
              בטל בחירה
            </button>
          </div>
          <TagSelector
            selected={bulkTags}
            onChange={setBulkTags}
            label="בחר תגיות להוספה לכל הפריטים הנבחרים"
          />
          <button
            onClick={handleBulkApply}
            disabled={applyingBulk || !bulkTags.length}
            className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            <Tag className="w-4 h-4" />
            {applyingBulk ? 'שומר...' : `החל תגיות על ${selected.size} פריטים`}
          </button>
        </div>
      )}

      {/* Messages */}
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

      {/* Select all bar */}
      {displayItems.length > 0 && (
        <div className="flex items-center gap-4 mb-3 text-sm text-white/60">
          <button onClick={selectAll} className="hover:text-white flex items-center gap-1">
            <CheckSquare className="w-4 h-4" /> בחר הכל ({displayItems.length})
          </button>
          <span>•</span>
          <span>{displayItems.filter((i) => i.tags.length > 0).length} עם תגיות</span>
          <span>•</span>
          <span>{displayItems.filter((i) => i.tags.length === 0).length} ללא תגיות</span>
        </div>
      )}

      {/* Loading */}
      {loading && !displayItems.length && (
        <div className="text-center py-16 text-white/50">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>טוען תמונות מ-S3...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && displayItems.length === 0 && (
        <div className="text-center py-16 text-white/50">
          <p className="text-lg mb-2">לא נמצאו קבצים</p>
          <p className="text-sm">נסה prefix אחר (לדוגמה: images/pergulot/)</p>
        </div>
      )}

      {/* Grid */}
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
                  : item.tags.length > 0
                  ? 'border-green-500/30'
                  : 'border-white/10 hover:border-white/30'
              }`}
            >
              {/* Thumbnail */}
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
                    {item.mimeType.startsWith('image/') ? '🖼' : '🎥'}{' '}
                    {filename.slice(0, 12)}
                  </div>
                )}

                {/* Selection checkbox */}
                <button
                  onClick={() => toggleSelect(item.key)}
                  className="absolute top-2 left-2 z-10 p-1 rounded bg-black/60 hover:bg-black/80 transition"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4 text-white/50" />
                  )}
                </button>

                {/* Indexed badge */}
                {item.indexed && (
                  <span className="absolute top-2 right-2 bg-green-600/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                    DB
                  </span>
                )}
              </div>

              {/* Card body */}
              <div className="p-2 space-y-1.5">
                <p className="text-xs text-white/60 truncate" title={item.key}>
                  {filename}
                </p>

                {/* Current tags */}
                {item.tags.length > 0 && !isEditing && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-blue-600/40 text-blue-200 px-1.5 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Edit mode */}
                {isEditing ? (
                  <div className="space-y-2">
                    <TagSelector selected={editTags} onChange={setEditTags} />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveTags(item.key, editTags)}
                        disabled={isSaving}
                        className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs"
                      >
                        {isSaving ? '...' : 'שמור'}
                      </button>
                      <button
                        onClick={() => setEditKey(null)}
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditKey(item.key)
                      setEditTags(item.tags)
                    }}
                    className="w-full py-1 rounded bg-white/5 hover:bg-white/15 text-xs text-white/60 hover:text-white transition-all flex items-center justify-center gap-1"
                  >
                    <Tag className="w-3 h-3" />
                    {item.tags.length > 0 ? 'ערוך תגיות' : 'הוסף תגיות'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => loadS3(nextToken)}
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
