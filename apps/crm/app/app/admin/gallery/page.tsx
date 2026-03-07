"use client"
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Trash2, RefreshCw, Eye, AlertTriangle } from 'lucide-react'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { ToastContainer, useToast } from '@/components/ui/toast'
import { galleryService } from '@/lib/api/gallery-service'
import { projectService } from '@/lib/api/project-service'
import type { GalleryCategory, GalleryImage, PergolaProject } from '@/lib/types/gallery'

type ViewMode = 'upload' | 'manage' | 'projects'

interface ConfirmState {
  message: string
  onConfirm: () => void
}

export default function GalleryAdminPage() {
  const t = useCRMTranslations()
  const { toasts, show: showToast, dismiss } = useToast()

  const [categories, setCategories] = useState<GalleryCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('upload')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  const [images, setImages] = useState<GalleryImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)

  const [projects, setProjects] = useState<PergolaProject[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)

  useEffect(() => {
    galleryService.fetchCategories()
      .then(data => {
        setCategories(data)
        if (data.length > 0) setSelectedCategory(data[0].key)
      })
      .catch(err => showToast((err as Error).message, 'error'))
  }, [showToast])

  const loadImages = useCallback(async () => {
    if (!selectedCategory) return
    setLoadingImages(true)
    try {
      setImages(await galleryService.fetchImages(selectedCategory))
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setLoadingImages(false)
    }
  }, [selectedCategory, showToast])

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    try {
      setProjects(await projectService.fetchProjects())
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setLoadingProjects(false)
    }
  }, [showToast])

  useEffect(() => {
    if (viewMode === 'manage' && selectedCategory) loadImages()
    if (viewMode === 'projects') loadProjects()
  }, [viewMode, selectedCategory, loadImages, loadProjects])

  const handleDeleteImage = (imageId: string, filename: string) => {
    setConfirm({
      message: `מחק "${filename}"?\n\nהתמונה תוסר מ-S3 ומהמסד.`,
      onConfirm: async () => {
        setConfirm(null)
        setDeletingImageId(imageId)
        try {
          await galleryService.deleteImage(imageId)
          showToast(`נמחק: ${filename}`, 'success')
          await loadImages()
        } catch (err) {
          showToast((err as Error).message, 'error')
        } finally {
          setDeletingImageId(null)
        }
      },
    })
  }

  const handleDeleteProject = (projectId: string, title: string, deleteS3: boolean) => {
    const message = deleteS3
      ? `מחק פרויקט "${title}" + כל התמונות מ-S3?\n\nפעולה זו אינה הפיכה!`
      : `מחק פרויקט "${title}" מהרשימה בלבד?\n(התמונות ב-S3 יישארו)`
    setConfirm({
      message,
      onConfirm: async () => {
        setConfirm(null)
        setDeletingProjectId(projectId)
        try {
          const result = await projectService.deleteProject(projectId, deleteS3)
          const s3Msg = deleteS3 && (result.s3_deleted?.length ?? 0) > 0
            ? ` (${result.s3_deleted!.length} תמונות נמחקו מ-S3)`
            : ''
          showToast(`פרויקט "${title}" נמחק${s3Msg}`, 'success')
          await loadProjects()
        } catch (err) {
          showToast((err as Error).message, 'error')
        } finally {
          setDeletingProjectId(null)
        }
      },
    })
  }

  const handleUpload = async () => {
    if (!selectedCategory) { showToast('בחר קטגוריה', 'error'); return }
    if (!files.length) { showToast('בחר קבצים', 'error'); return }

    const validationError = galleryService.validateFiles(files)
    if (validationError) { showToast(validationError, 'error'); return }

    const batches = galleryService.buildBatches(files)
    setUploading(true)
    let totalUploaded = 0
    const allImageUrls: string[] = []

    try {
      for (const batch of batches) {
        const result = await galleryService.uploadBatch(batch, selectedCategory, folderName)
        totalUploaded += result.uploaded ?? 0
        allImageUrls.push(...(result.images ?? []).map(img => img.url))
      }

      if (folderName.trim() && allImageUrls.length > 0) {
        try {
          await projectService.createProject({ title_he: folderName.trim(), images: allImageUrls })
          showToast(`הועלו ${totalUploaded} קבצים לתיקייה "${folderName.trim()}" — פרויקט נוצר אוטומטית`, 'success')
        } catch {
          showToast(`הועלו ${totalUploaded} קבצים לתיקייה "${folderName.trim()}"`, 'success')
        }
      } else {
        showToast(`הועלו ${totalUploaded} קבצים בהצלחה`, 'success')
      }

      setFiles([])
      if (viewMode === 'manage') setTimeout(loadImages, 1000)
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="container py-8 text-white">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {confirm !== null && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.gallery.title}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link href="/app/admin/deals" className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold">{t.nav.deals}</Link>
          <Link href="/app/admin/statistics" className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold">{t.nav.statistic}</Link>
          <Link href="/app/admin/leads" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold">{t.nav.leads}</Link>
          <Link href="/app/admin/ai-chats" className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold">{t.nav.aiChats}</Link>
          <Link href="/app/admin/articles" className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold">{t.nav.articles}</Link>
          <Link href="/app/admin/workers" className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold">{t.nav.workers}</Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['upload', 'manage', 'projects'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              viewMode === mode
                ? mode === 'upload' ? 'bg-blue-600 text-white'
                  : mode === 'manage' ? 'bg-red-600 text-white'
                  : 'bg-purple-600 text-white'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {mode === 'upload' ? 'העלאת תמונות' : mode === 'manage' ? 'ניהול תמונות' : 'פרויקטים'}
          </button>
        ))}
      </div>

      {/* Upload */}
      {viewMode === 'upload' && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-5">
          <StepRow number={1} label="בחר קטגוריה">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full max-w-xs bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
            >
              {categories.map(c => (
                <option key={c.id} value={c.key}>{c.name_he || c.key}</option>
              ))}
            </select>
          </StepRow>

          <StepRow number={2} label="שם תיקייה / פרויקט" hint="(אופציונלי — אם תמלא, פרויקט ייווצר אוטומטית)">
            <input
              type="text"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              placeholder="לדוגמה: פרגולה אשדוד"
              className="w-full max-w-sm bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder:text-white/30"
            />
            {folderName.trim() && (
              <p className="text-xs text-emerald-400 mt-1">
                נתיב: images/{selectedCategory}/{folderName.trim().replace(/\s+/g, '_')}/... — פרויקט ייווצר אוטומטית
              </p>
            )}
          </StepRow>

          <StepRow number={3} label="בחר תמונות (אפשר לבחור כמה בבת אחת)">
            <input type="file" multiple accept="image/*" onChange={e => setFiles(e.target.files ? Array.from(e.target.files) : [])} className="w-full text-white" />
            {files.length > 0 && <p className="text-sm text-green-300 font-medium mt-1">{files.length} קבצים נבחרו</p>}
          </StepRow>

          <button
            onClick={handleUpload}
            disabled={uploading || !files.length}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 font-semibold transition-colors"
          >
            {uploading ? `מעלה... (${files.length} קבצים)` : `העלה ל-S3${files.length > 0 ? ` (${files.length} קבצים)` : ''}`}
          </button>
        </div>
      )}

      {/* Manage */}
      {viewMode === 'manage' && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
          <SectionHeader title="ניהול תמונות" subtitle="צפה ומחק תמונות לפי קטגוריה" loading={loadingImages} onRefresh={loadImages} />
          <div className="space-y-2">
            <label className="text-sm text-white/70">בחר קטגוריה</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full max-w-md bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
            >
              {categories.map(c => (
                <option key={c.id} value={c.key}>{c.name_he || c.key} ({c.image_count ?? 0} תמונות)</option>
              ))}
            </select>
          </div>

          {loadingImages && <Spinner label="טוען תמונות..." />}

          {!loadingImages && images.length === 0 && (
            <EmptyState title="אין תמונות בקטגוריה זו" subtitle='העלה תמונות דרך הכרטיסייה "העלאת תמונות"' />
          )}

          {!loadingImages && images.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-white/70">{images.length} תמונות בקטגוריה <span className="font-bold">{selectedCategory}</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map(img => (
                  <div key={img.id} className="group relative bg-black/30 rounded-lg border border-white/10 overflow-hidden hover:border-white/30 transition-all">
                    <div className="aspect-square relative">
                      <Image src={img.url} alt={img.filename} fill className="object-cover" unoptimized />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a href={img.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full" title="צפה בתמונה">
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteImage(img.id, img.filename)}
                          disabled={deletingImageId === img.id}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-full disabled:opacity-50"
                        >
                          {deletingImageId === img.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="p-2 text-xs text-white/70 truncate" title={img.filename}>{img.filename}</div>
                    <div className="px-2 pb-2 text-xs text-white/50">{new Date(img.created_at).toLocaleDateString('he-IL')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Projects */}
      {viewMode === 'projects' && (
        <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-4">
          <SectionHeader title="פרויקטים" subtitle="רשימת כל הפרויקטים ב-Our Projects" loading={loadingProjects} onRefresh={loadProjects} />

          {loadingProjects && <Spinner label="טוען פרויקטים..." />}

          {!loadingProjects && projects.length === 0 && (
            <EmptyState title="אין פרויקטים" subtitle="העלה תמונות עם שם תיקייה ליצירת פרויקט" />
          )}

          {!loadingProjects && projects.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-white/60">{projects.length} פרויקטים</p>
              {projects.map(proj => (
                <div key={proj.id} className="bg-black/30 rounded-lg border border-white/10 p-4 flex items-start gap-4">
                  {proj.images?.[0] && (
                    <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-black/30">
                      <Image src={proj.images[0]} alt={proj.title_he} fill className="object-cover" unoptimized />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{proj.title_he}</p>
                    {proj.title_ru && <p className="text-sm text-white/60">{proj.title_ru}</p>}
                    <p className="text-xs text-white/40 mt-1">
                      {proj.images?.length ?? 0} תמונות • {new Date(proj.created_at).toLocaleDateString('he-IL')}
                    </p>
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {proj.images.slice(0, 5).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline truncate max-w-[120px]">
                          תמונה {i + 1}
                        </a>
                      ))}
                      {proj.images.length > 5 && <span className="text-xs text-white/40">+{proj.images.length - 5} עוד</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteProject(proj.id, proj.title_he, false)}
                      disabled={deletingProjectId === proj.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/80 hover:bg-yellow-600 rounded text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                    >
                      {deletingProjectId === proj.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      מחק רשומה
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj.id, proj.title_he, true)}
                      disabled={deletingProjectId === proj.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs font-medium disabled:opacity-50 whitespace-nowrap"
                    >
                      {deletingProjectId === proj.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepRow({ number, label, hint, children }: { number: number; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">{number}</span>
      <div className="flex-1 space-y-1.5">
        <label className="text-sm font-medium text-white">
          {label}
          {hint && <span className="text-white/40 font-normal text-xs mr-2">{hint}</span>}
        </label>
        {children}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, loading, onRefresh }: { title: string; subtitle: string; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-white/60">{subtitle}</p>
      </div>
      <button onClick={onRefresh} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        רענן
      </button>
    </div>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-white/60">
      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
      <p>{label}</p>
    </div>
  )
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center py-12 text-white/60">
      <p className="text-lg mb-2">{title}</p>
      <p className="text-sm">{subtitle}</p>
    </div>
  )
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-white text-sm whitespace-pre-line">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm transition">
            ביטול
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-sm font-semibold transition">
            אישור
          </button>
        </div>
      </div>
    </div>
  )
}
