"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { Trash2, RefreshCw, Eye } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'

interface GalleryImage {
  id: string
  url: string
  filename: string
  category_key: string
  created_at: string
}

export default function GalleryAdminPage() {
  const t = useCRMTranslations()
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<number>(0)
  const [folderName, setFolderName] = useState('')
  
  // Gallery management state
  const [images, setImages] = useState<GalleryImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'upload' | 'manage' | 'projects'>('upload')

  // Projects state
  interface PergolaProject { id: string; title_he: string; title_ru?: string; images: string[]; created_at: string }
  const [projects, setProjects] = useState<PergolaProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await authFetch('/admin-api/gallery/categories')
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
  }, [])

  // Load images when category changes or after upload
  useEffect(() => {
    if (viewMode === 'manage' && selectedCategory) {
      loadImages()
    }
    if (viewMode === 'projects') {
      loadProjects()
    }
  }, [selectedCategory, viewMode])

  const loadImages = async () => {
    if (!selectedCategory) return
    setLoadingImages(true)
    setError(null)
    try {
      const res = await authFetch(`/admin-api/gallery/images?category_key=${selectedCategory}`)
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
      const res = await authFetch(`/admin-api/gallery/images?id=${imageId}`, {
        method: 'DELETE',
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

  const loadProjects = async () => {
    setLoadingProjects(true)
    setError(null)
    try {
      const res = await authFetch('/admin-api/pergola-projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleDeleteProject = async (projectId: string, title: string, deleteS3: boolean) => {
    const confirmMsg = deleteS3
      ? `מחק פרויקט "${title}" + כל התמונות מ-S3?\n\nפעולה זו אינה הפיכה!`
      : `מחק פרויקט "${title}" מהרשימה בלבד?\n(התמונות ב-S3 יישארו)`
    if (!confirm(confirmMsg)) return

    setDeletingProjectId(projectId)
    setError(null)
    setMessage(null)
    try {
      const url = `/admin-api/pergola-projects?id=${projectId}${deleteS3 ? '&delete_s3=1' : ''}`
      const res = await authFetch(url, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete project')
      const s3Msg = deleteS3 && data.s3_deleted?.length > 0
        ? ` (${data.s3_deleted.length} תמונות נמחקו מ-S3)`
        : ''
      setMessage(`פרויקט "${title}" נמחק${s3Msg}`)
      await loadProjects()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingProjectId(null)
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
    
    setError(null)
    setMessage(null)
    setUploading(true)
    setUploaded(0)
    try {
      const form = new FormData()
      form.append('category_key', selectedCategory)
      if (folderName.trim()) form.append('folder_name', folderName.trim())
      files.forEach(f => form.append('files', f))
      
      const res = await authFetch('/admin-api/gallery/upload', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      const uploadedCount = data.uploaded || 0
      setUploaded(uploadedCount)

      // Auto-create pergola_projects record if folder name given and category is pergulot
      if (folderName.trim() && data.images?.length > 0) {
        const imageUrls = (data.images as Array<{ url: string }>).map(img => img.url)
        try {
          const projRes = await authFetch('/admin-api/pergola-projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title_he: folderName.trim(),
              desc_he: null,
              images: imageUrls,
            }),
          })
          if (projRes.ok) {
            setMessage(`הועלו ${uploadedCount} קבצים לתיקייה "${folderName.trim()}" ✓ פרויקט נוצר אוטומטית`)
          } else {
            setMessage(`הועלו ${uploadedCount} קבצים לתיקייה "${folderName.trim()}" (שגיאה ביצירת פרויקט)`)
          }
        } catch {
          setMessage(`הועלו ${uploadedCount} קבצים לתיקייה "${folderName.trim()}"`)
        }
      } else {
        setMessage(`הועלו ${uploadedCount} קבצים בהצלחה`)
      }

      setFiles([])
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


  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.gallery.title}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app/admin/deals"
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href="/app/admin/statistics"
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            {t.nav.statistic}
          </Link>
          <Link
            href="/app/admin/leads"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href="/app/admin/ai-chats"
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {t.nav.aiChats}
          </Link>
          <Link
            href="/app/admin/articles"
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <Link
            href="/app/admin/workers"
            className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold"
          >
            {t.nav.workers}
          </Link>
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
        <button
          onClick={() => setViewMode('projects')}
          className={`px-4 py-2 rounded font-semibold transition-colors ${
            viewMode === 'projects'
              ? 'bg-purple-600 text-white'
              : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          📁 פרויקטים
        </button>
      </div>

      {/* Upload Section */}
      {viewMode === 'upload' && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-5">

          {/* Step 1 — Category */}
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">1</span>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-white">בחר קטגוריה</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full max-w-xs bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
              >
                {categories.map((c: any) => (
                  <option key={c.id} value={c.key}>{c.name_he || c.key}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2 — Folder / Project name */}
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">2</span>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-white">
                שם תיקייה / פרויקט
                <span className="text-white/40 font-normal text-xs mr-2">(אופציונלי — אם תמלא, פרויקט ייווצר אוטומטית)</span>
              </label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="לדוגמה: פרגולה אשדוד"
                className="w-full max-w-sm bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder:text-white/30"
              />
              {folderName.trim() && (
                <p className="text-xs text-emerald-400">
                  ✓ נתיב: images/{selectedCategory}/{folderName.trim().replace(/\s+/g, '_')}/... • פרויקט ייווצר אוטומטית
                </p>
              )}
            </div>
          </div>

          {/* Step 3 — Files */}
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">3</span>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-white">בחר תמונות (אפשר לבחור כמה בבת אחת)</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={onFileChange}
                className="w-full text-white"
              />
              {files.length > 0 && (
                <p className="text-sm text-green-300 font-medium">✓ {files.length} קבצים נבחרו</p>
              )}
            </div>
          </div>

          {/* Step 4 — Upload button */}
          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleUpload}
              disabled={uploading || !files.length}
              className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 font-semibold text-white transition-colors"
            >
              {uploading ? `מעלה... (${files.length} קבצים)` : `העלה ל-S3${files.length > 0 ? ` (${files.length} קבצים)` : ''}`}
            </button>
          </div>

          {message && <div className="bg-green-500/20 border border-green-500/40 rounded p-3 text-green-300 text-sm">{message}</div>}
          {error && <div className="bg-red-500/20 border border-red-500/40 rounded p-3 text-red-300 text-sm">{error}</div>}
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

      {/* Projects Section */}
      {viewMode === 'projects' && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">פרויקטים</h2>
              <p className="text-sm text-white/60">רשימת כל הפרויקטים ב-Our Projects</p>
            </div>
            <button
              onClick={loadProjects}
              disabled={loadingProjects}
              className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingProjects ? 'animate-spin' : ''}`} />
              רענן
            </button>
          </div>

          {message && (
            <div className="bg-green-500/20 border border-green-500/50 rounded p-3 text-green-300">{message}</div>
          )}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded p-3 text-red-300">{error}</div>
          )}

          {loadingProjects && (
            <div className="text-center py-8 text-white/60">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>טוען פרויקטים...</p>
            </div>
          )}

          {!loadingProjects && projects.length === 0 && (
            <div className="text-center py-12 text-white/60">
              <p className="text-lg mb-2">אין פרויקטים</p>
              <p className="text-sm">העלה תמונות עם שם תיקייה ליצירת פרויקט</p>
            </div>
          )}

          {!loadingProjects && projects.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-white/60">{projects.length} פרויקטים</p>
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="bg-black/30 rounded-lg border border-white/10 p-4 flex items-start gap-4"
                >
                  {/* First image preview */}
                  {proj.images?.[0] && (
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-black/30">
                      <Image
                        src={proj.images[0]}
                        alt={proj.title_he}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{proj.title_he}</p>
                    {proj.title_ru && <p className="text-sm text-white/60">{proj.title_ru}</p>}
                    <p className="text-xs text-white/40 mt-1">
                      {proj.images?.length || 0} תמונות • {new Date(proj.created_at).toLocaleDateString('he-IL')}
                    </p>
                    {/* Image URLs preview */}
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {(proj.images || []).slice(0, 5).map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline truncate max-w-[120px]"
                        >
                          תמונה {i + 1}
                        </a>
                      ))}
                      {(proj.images?.length || 0) > 5 && (
                        <span className="text-xs text-white/40">+{proj.images.length - 5} עוד</span>
                      )}
                    </div>
                  </div>

                  {/* Delete buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDeleteProject(proj.id, proj.title_he, false)}
                      disabled={deletingProjectId === proj.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-600 rounded text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                      title="מחק רק מהרשימה, התמונות ב-S3 יישארו"
                    >
                      {deletingProjectId === proj.id
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                      מחק רשומה
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj.id, proj.title_he, true)}
                      disabled={deletingProjectId === proj.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                      title="מחק פרויקט + כל התמונות מ-S3"
                    >
                      {deletingProjectId === proj.id
                        ? <RefreshCw className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                      מחק + S3
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

