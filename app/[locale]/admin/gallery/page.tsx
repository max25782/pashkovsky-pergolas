"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

export default function GalleryAdminPage({ params: { locale } }: { params: { locale: Locale } }) {
  const t = useCRMTranslations()
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<number>(0)
  const [projTitle, setProjTitle] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projImages, setProjImages] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token')
    if (storedToken) setToken(storedToken)
  }, [])

  function save() {
    if (input.trim()) {
      localStorage.setItem('admin_token', input.trim())
      setToken(input.trim())
    }
  }

  function logout() {
    localStorage.removeItem('admin_token')
    setToken(null)
    setInput('')
  }

  useEffect(() => {
    async function loadCategories() {
      if (!token) return
      try {
        const res = await fetch('/admin-api/gallery/categories', {
          headers: { 'x-admin-token': token }
        })
        if (!res.ok) throw new Error('Failed to fetch categories')
        const data = await res.json()
        setCategories(data.data || [])
        if ((data.data || []).length > 0) {
          setSelectedCategory(data.data[0].key)
        }
      } catch (e: any) {
        console.error(e)
        setError(e.message)
      }
    }
    loadCategories()
  }, [token])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    setFiles(Array.from(e.target.files))
  }

  const handleUpload = async () => {
    if (!selectedCategory) {
      setError('בחר קטגוריה')
      return
    }
    if (!files.length) {
      setError('בחר קבצים')
      return
    }
    setError(null)
    setMessage(null)
    setUploading(true)
    setUploaded(0)
    try {
      const form = new FormData()
      form.append('category_key', selectedCategory)
      files.forEach(f => form.append('files', f))
      const res = await fetch('/admin-api/gallery/upload', {
        method: 'POST',
        headers: { 'x-admin-token': token || '' },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      setUploaded(data.uploaded || 0)
      setMessage(`הועלו ${data.uploaded || 0} קבצים בהצלחה`)
      setFiles([])
    } catch (e: any) {
      console.error(e)
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!projTitle.trim()) {
      setError('הזן שם פרויקט')
      return
    }
    const imagesArr = projImages.split('\n').map(s => s.trim()).filter(Boolean)
    if (imagesArr.length === 0) {
      setError('הוסף לפחות כתובת תמונה אחת (S3)')
      return
    }
    setError(null)
    setMessage(null)
    setCreatingProject(true)
    try {
      const res = await fetch('/admin-api/pergola-projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify({
          title_he: projTitle.trim(),
          desc_he: projDesc.trim() || null,
          images: imagesArr,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create project')
      setMessage('פרויקט נוצר בהצלחה')
      setProjTitle('')
      setProjDesc('')
      setProjImages('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreatingProject(false)
    }
  }

  if (!token) {
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Admin • {t.gallery.title}</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">{t.auth.enterAdminToken}</label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/20"
            placeholder={t.auth.adminTokenPlaceholder}
          />
          <button onClick={save} className="mt-3 px-4 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.continue}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.gallery.title}</h1>
        <div className="flex gap-2">
          <Link
            href={`/${locale}/admin/deals`}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href={`/${locale}/admin/leads`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href={`/${locale}/admin/articles`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
          </button>
        </div>
      </div>
      <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-white/70">קטגוריה</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
            >
              {categories.map((c: any) => (
                <option key={c.id} value={c.key}>{c.name_he || c.key}</option>
              ))}
            </select>
            <p className="text-xs text-white/50">טען תמונות לכל קטגוריות האתר דרך S3</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-white/70">קבצים (jpg/png/webp/gif)</label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={onFileChange}
              className="w-full text-white"
            />
            {files.length > 0 && (
              <p className="text-xs text-green-300">{files.length} קבצים נבחרו</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'מעלה...' : 'העלה ל-S3'}
          </button>
          {uploaded > 0 && (
            <span className="text-green-300 text-sm">הועלו {uploaded} קבצים</span>
          )}
        </div>

        {message && <div className="text-green-300 text-sm">{message}</div>}
        {error && <div className="text-red-300 text-sm">{error}</div>}

        <div className="text-white/60 text-sm">
          - קבצים מומלצים: עד 10MB, תמונות באיכות טובה<br/>
          - נשמרים ב-S3 עם פרוססינג ל-WebP<br/>
          - המטא-דאטה נשמר ב-Supabase בטבלת gallery_images<br/>
          - הקטגוריות מגיעות מטבלת gallery_categories (משותפות לכל האתר)
        </div>

        <div className="border-t border-white/10 pt-6">
          <h3 className="text-lg font-semibold mb-3">צור פרויקט פרגולה (pergulot)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-white/70">שם פרויקט (he)</label>
              <input
                value={projTitle}
                onChange={(e) => setProjTitle(e.target.value)}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
                placeholder="לדוגמה: פרגולה אשדוד"
              />
              <label className="text-sm text-white/70">תיאור (he)</label>
              <textarea
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white min-h-[90px]"
                placeholder="אופציונלי"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-white/70">כתובות תמונות (S3) — כל כתובת בשורה</label>
              <textarea
                value={projImages}
                onChange={(e) => setProjImages(e.target.value)}
                className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white min-h-[140px]"
                placeholder="https://pashkovsky-gallery.s3.../images/pergulas/...\nhttps://..."
              />
              <button
                onClick={handleCreateProject}
                disabled={creatingProject}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {creatingProject ? 'יוצר...' : 'צור פרויקט'}
              </button>
            </div>
          </div>
          <p className="text-xs text-white/50 mt-2">הפרויקט נשמר בטבלה pergola_projects ונשלף אוטומטית ל-Our Projects.</p>
        </div>
      </div>
    </main>
  )
}

