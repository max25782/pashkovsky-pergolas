'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import type { GalleryCategory } from './gallery-types'

interface Props {
  categories: GalleryCategory[]
  selectedCategory: string
  onCategoryChange: (key: string) => void
}

export function GalleryUploadTab({ categories, selectedCategory, onCategoryChange }: Props) {
  const toast = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [folderName, setFolderName] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleUpload() {
    if (!selectedCategory) { toast.error('בחר קטגוריה'); return }
    if (!files.length) { toast.error('בחר קבצים'); return }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('category_key', selectedCategory)
      if (folderName.trim()) form.append('folder_name', folderName.trim())
      files.forEach((f) => form.append('files', f))

      const res = await authFetch('/admin-api/gallery/upload', { method: 'POST', body: form })
      const data = await res.json() as { uploaded?: number; images?: Array<{ url: string }>; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')

      const count = data.uploaded ?? 0

      if (folderName.trim() && data.images && data.images.length > 0) {
        const imageUrls = data.images.map((img) => img.url)
        try {
          const projRes = await authFetch('/admin-api/pergola-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title_he: folderName.trim(), desc_he: null, images: imageUrls }),
          })
          if (projRes.ok) {
            toast.success(`הועלו ${count} קבצים לתיקייה "${folderName.trim()}" — פרויקט נוצר`)
          } else {
            toast.success(`הועלו ${count} קבצים לתיקייה "${folderName.trim()}"`)
          }
        } catch {
          toast.success(`הועלו ${count} קבצים לתיקייה "${folderName.trim()}"`)
        }
      } else {
        toast.success(`הועלו ${count} קבצים בהצלחה`)
      }

      setFiles([])
      setFolderName('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-white/70">קטגוריה</label>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.key}>{c.name_he ?? c.key}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-white/70">
            שם תיקייה / פרויקט <span className="text-white/40">(אופציונלי)</span>
          </label>
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="לדוגמה: פרגולה אשדוד"
            className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder:text-white/30"
          />
          <p className="text-xs text-white/40">
            images/{selectedCategory}/{folderName.trim() || '<ללא תיקייה>'}/...
            {folderName.trim() && ' • פרויקט ייווצר אוטומטית'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-white/70">קבצים (jpg/png/webp/gif)</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          className="w-full text-white"
        />
        {files.length > 0 && (
          <p className="text-xs text-green-300">{files.length} קבצים נבחרו</p>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? 'מעלה...' : 'העלה ל-S3'}
      </button>

      <p className="text-white/60 text-sm">
        - קבצים מומלצים: עד 10MB, תמונות באיכות טובה<br />
        - נשמרים ב-S3 עם פרוססינג ל-WebP<br />
        - המטא-דאטה נשמר ב-Supabase בטבלת gallery_images
      </p>
    </div>
  )
}
