'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import type { GalleryCategory } from './gallery-types'

/** One file per request — avoids 413 from strict proxies (e.g. nginx 1m, Cloudflare). */
async function parseUploadResponse(res: Response): Promise<{
  ok: boolean
  status: number
  data: { uploaded?: number; images?: Array<{ url: string }>; error?: string }
}> {
  const text = await res.text()
  if (res.status === 413) {
    return {
      ok: false,
      status: 413,
      data: {
        error:
          'הקובץ גדול מדי לשרת (413). נסה תמונה קטנה יותר או בקש מהמנהל להגדיל client_max_body_size ב-Nginx.',
      },
    }
  }
  try {
    const data = JSON.parse(text) as { uploaded?: number; images?: Array<{ url: string }>; error?: string }
    return { ok: res.ok, status: res.status, data }
  } catch {
    const snippet = text.trim().slice(0, 80)
    return {
      ok: false,
      status: res.status,
      data: {
        error:
          res.status === 413 || /too large|413/i.test(text)
            ? 'העלאה נחסמה — הקובץ או הבקשה גדולים מדי לשרת.'
            : snippet || `שגיאת שרת (${res.status})`,
      },
    }
  }
}

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
      let totalUploaded = 0
      const allImageUrls: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const form = new FormData()
        form.append('category_key', selectedCategory)
        if (folderName.trim()) form.append('folder_name', folderName.trim())
        form.append('files', file)

        const res = await authFetch('/admin-api/gallery/upload', { method: 'POST', body: form })
        const { ok, data } = await parseUploadResponse(res)

        if (!ok) {
          throw new Error(
            data.error ??
              `העלאה נכשלה (${file.name}). נסה קובץ קטן יותר או העלה פחות תמונות בכל פעם.`,
          )
        }

        const count = data.uploaded ?? 0
        totalUploaded += count
        if (data.images) {
          data.images.forEach((img) => allImageUrls.push(img.url))
        }
      }

      if (folderName.trim() && allImageUrls.length > 0) {
        try {
          const projRes = await authFetch('/admin-api/pergola-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title_he: folderName.trim(), desc_he: null, images: allImageUrls }),
          })
          if (projRes.ok) {
            toast.success(`הועלו ${totalUploaded} קבצים לתיקייה "${folderName.trim()}" — פרויקט נוצר`)
          } else {
            toast.success(`הועלו ${totalUploaded} קבצים לתיקייה "${folderName.trim()}"`)
          }
        } catch {
          toast.success(`הועלו ${totalUploaded} קבצים לתיקייה "${folderName.trim()}"`)
        }
      } else {
        toast.success(`הועלו ${totalUploaded} קבצים בהצלחה`)
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
        - קבצים מומלצים: עד 10MB לכל תמונה (אם יש שגיאת 413 — הקטן את הקבצים או הגדל את מגבלת Nginx)<br />
        - העלאה: קובץ אחד בכל בקשה (מונע חסימה של שרת/פרוקסי)<br />
        - נשמרים ב-S3 עם פרוססינג ל-WebP<br />
        - המטא-דאטה נשמר ב-Supabase בטבלת gallery_images
      </p>
    </div>
  )
}
