"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { Trash2, RefreshCw, Eye } from 'lucide-react'

interface GalleryImage {
  id: string
  url: string
  filename: string
  category_key: string
  created_at: string
}

export default function GalleryAdminPage(()) {
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
  
  // Gallery management state
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'upload' | 'manage'>('upload')

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
        console.log('📦 Categories loaded:', data.data)
        setCategories(data.data || [])
        if ((data.data || []).length > 0) {
          const firstKey = data.data[0].key
          console.log('🎯 Auto-selected category:', firstKey)
          setSelectedCategory(firstKey)
        }
      } catch (e: any) {
        console.error(e)
        setError(e.message)
      }
    }
    loadCategories()
  }, [token])

  // Load images when category changes or after upload
  useEffect(() => {
    if (viewMode === 'manage' && selectedCategory && token) {
      loadImages()
    }
  }, [selectedCategory, token, viewMode])

  const loadImages = async () => {
    if (!selectedCategory || !token) return
    setLoadingImages(true)
    setError(null)
    try {
      const res = await fetch(`/admin-api/gallery/images?category_key=${selectedCategory}`, {
        headers: { 'x-admin-token': token }
      })
      if (!res.ok) throw new Error('Failed to fetch images')
      const data = await res.json()
      setImages(data.images || [])
    } catch (e: any) {
      console.error(e)
      setError(e.message)
    } finally {
      setLoadingImages(false)
    }
  }

  const handleDeleteImage = async (imageId: string, filename: string) => {
    if (!confirm(`Delete "${filename}"?\n\nThis will remove the image from both S3 and database.`)) {
      return
    }
    
    setDeletingId(imageId)
    setError(null)
    setMessage(null)
    
    try {
      const res = await fetch(`/admin-api/gallery/images?id=${imageId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token || '' }
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete image')
      }
      
      setMessage(`נמחק: ${filename}`)
      // Refresh the images list
      await loadImages()
    } catch (e: any) {
      console.error(e)
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

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
    
    console.log('🚀 Upload started:', { selectedCategory, filesCount: files.length })
    
    setError(null)
    setMessage(null)
    setUploading(true)
    setUploaded(0)
    try {
      const form = new FormData()
      form.append('category_key', selectedCategory)
      files.forEach(f => form.append('files', f))
      
      console.log('📤 Sending to API:', { category_key: selectedCategory })
      
      const res = await fetch('/admin-api/gallery/upload', {
        method: 'POST',
        headers: { 'x-admin-token': token || '' },
        body: form,
      })
      const data = await res.json()
      
      console.log('📥 API Response:', data)
      
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }
      setUploaded(data.uploaded || 0)
      setMessage(`הועלו ${data.uploaded || 0} קבצים בהצלחה`)
      setFiles([])
      // Refresh images if in manage mode
      if (viewMode === 'manage') {
        setTimeout(() => loadImages(), 1000)
      }
    } catch (e: any) {
      console.error('❌ Upload error:', e)
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
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`//app/admin/deals`}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href={`//app/admin/deals`}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            {t.nav.statistic}
          </Link>
          <Link
            href={`//app/admin/leads`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href={`//app/admin/ai-chats`}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {t.nav.aiChats}
          </Link>
          <Link
            href={`//app/admin/articles`}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <Link
            href={`//app/admin/workers`}
            className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold"
          >
            {t.nav.workers}
          </Link>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('upload')}
          className={`px-4 py-2 rounded font-semibold transition-colors ${
            viewMode === 'upload' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          📤 העלאת תמונות
        </button>
        <button
          onClick={() => setViewMode('manage')}
          className={`px-4 py-2 rounded font-semibold transition-colors ${
            viewMode === 'manage' 
              ? 'bg-red-600 text-white' 
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          🗑️ ניהול תמונות
        </button>
      </div>

      {/* Upload Section */}
      {viewMode === 'upload' && (
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
      )}

      {/* Manage Images Section */}
      {viewMode === 'manage' && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">ניהול תמונות</h2>
              <p className="text-sm text-white/60">צפה ומחק תמונות לפי קטגוריה</p>
            </div>
            <button
              onClick={loadImages}
              disabled={loadingImages}
              className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingImages ? 'animate-spin' : ''}`} />
              רענן
            </button>
          </div>

          {/* Category Selector */}
          <div className="space-y-2">
            <label className="text-sm text-white/70">בחר קטגוריה</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full max-w-md bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
            >
              {categories.map((c: any) => (
                <option key={c.id} value={c.key}>
                  {c.name_he || c.key} ({c.image_count || 0} תמונות)
                </option>
              ))}
            </select>
          </div>

          {/* Messages */}
          {message && (
            <div className="bg-green-500/20 border border-green-500/50 rounded p-3 text-green-300">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loadingImages && (
            <div className="text-center py-8 text-white/60">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>טוען תמונות...</p>
            </div>
          )}

          {/* Images Grid */}
          {!loadingImages && images.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/70">
                  {images.length} תמונות בקטגוריה <span className="font-bold">{selectedCategory}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="group relative bg-black/30 rounded-lg border border-white/10 overflow-hidden hover:border-white/30 transition-all"
                  >
                    {/* Image */}
                    <div className="aspect-square relative">
                      <Image
                        src={img.url}
                        alt={img.filename}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      {/* Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full"
                          title="צפה בתמונה"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteImage(img.id, img.filename)}
                          disabled={deletingId === img.id}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-full disabled:opacity-50"
                          title="מחק תמונה"
                        >
                          {deletingId === img.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {/* Filename */}
                    <div className="p-2 text-xs text-white/70 truncate" title={img.filename}>
                      {img.filename}
                    </div>
                    {/* Date */}
                    <div className="px-2 pb-2 text-xs text-white/50">
                      {new Date(img.created_at).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loadingImages && images.length === 0 && (
            <div className="text-center py-12 text-white/60">
              <p className="text-lg mb-2">אין תמונות בקטגוריה זו</p>
              <p className="text-sm">העלה תמונות דרך הכרטיסייה "העלאת תמונות"</p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

