'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import { ImageGrid } from './ImageGrid'
import type { GalleryCategory, GalleryImage } from './gallery-types'

interface Props {
  categories: GalleryCategory[]
  selectedCategory: string
  onCategoryChange: (key: string) => void
}

export function GalleryManageTab({ categories, selectedCategory, onCategoryChange }: Props) {
  const toast = useToast()
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadImages() {
    if (!selectedCategory) return
    setLoading(true)
    try {
      const res = await authFetch(`/admin-api/gallery/images?category_key=${selectedCategory}`)
      if (!res.ok) throw new Error('Failed to fetch images')
      const data = await res.json() as { images?: GalleryImage[] }
      setImages(data.images ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load images'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadImages() }, [selectedCategory])

  async function handleDeleteImage(imageId: string, filename: string) {
    if (!confirm(`Delete "${filename}"?\n\nThis will remove the image from both S3 and database.`)) return
    setDeletingId(imageId)
    try {
      const res = await authFetch(`/admin-api/gallery/images?id=${imageId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to delete image')
      }
      toast.success(`נמחק: ${filename}`)
      await loadImages()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">ניהול תמונות</h2>
          <p className="text-sm text-white/60">צפה ומחק תמונות לפי קטגוריה</p>
        </div>
        <button
          onClick={loadImages}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          רענן
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-white/70">בחר קטגוריה</label>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full max-w-md bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.key}>
              {c.name_he ?? c.key} ({c.image_count ?? 0} תמונות)
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-white/60">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>טוען תמונות...</p>
        </div>
      ) : (
        <ImageGrid
          images={images}
          deletingId={deletingId}
          categoryKey={selectedCategory}
          onDelete={handleDeleteImage}
        />
      )}
    </div>
  )
}
