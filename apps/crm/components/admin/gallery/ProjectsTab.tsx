'use client'

import { useState, useEffect } from 'react'
import { Trash2, RefreshCw } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import type { PergolaProject } from './gallery-types'

export function ProjectsTab() {
  const toast = useToast()
  const [projects, setProjects] = useState<PergolaProject[]>([])
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [imagesText, setImagesText] = useState('')
  const [creating, setCreating] = useState(false)

  async function loadProjects() {
    setLoading(true)
    try {
      const res = await authFetch('/admin-api/pergola-projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json() as { projects?: PergolaProject[] }
      setProjects(data.projects ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load projects'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjects() }, [])

  async function handleDeleteProject(projectId: string, projectTitle: string, deleteS3: boolean) {
    const confirmMsg = deleteS3
      ? `מחק פרויקט "${projectTitle}" + כל התמונות מ-S3?\n\nפעולה זו אינה הפיכה!`
      : `מחק פרויקט "${projectTitle}" מהרשימה בלבד?\n(התמונות ב-S3 יישארו)`
    if (!confirm(confirmMsg)) return

    setDeletingId(projectId)
    try {
      const url = `/admin-api/pergola-projects?id=${projectId}${deleteS3 ? '&delete_s3=1' : ''}`
      const res = await authFetch(url, { method: 'DELETE' })
      const data = await res.json() as { error?: string; s3_deleted?: string[] }
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete project')
      const s3Msg = deleteS3 && data.s3_deleted && data.s3_deleted.length > 0
        ? ` (${data.s3_deleted.length} תמונות נמחקו מ-S3)`
        : ''
      toast.success(`פרויקט "${projectTitle}" נמחק${s3Msg}`)
      await loadProjects()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleCreateProject() {
    if (!title.trim()) { toast.error('הזן שם פרויקט'); return }
    const images = imagesText
      .split(/[\n,]+/)
      .map((s) => s.trim().replace(/^['"`]+|['"`]+$/g, '').trim())
      .filter((s) => s.startsWith('http'))
    if (images.length === 0) { toast.error('הוסף לפחות כתובת תמונה אחת (S3)'); return }

    setCreating(true)
    try {
      const res = await authFetch('/admin-api/pergola-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title_he: title.trim(), desc_he: desc.trim() || null, images }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to create project')
      toast.success('פרויקט נוצר בהצלחה')
      setTitle('')
      setDesc('')
      setImagesText('')
      await loadProjects()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project'
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-6 space-y-6">
      {/* Create form */}
      <div>
        <h3 className="text-lg font-semibold mb-3">צור פרויקט פרגולה</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-white/70">שם פרויקט (he)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-black/30 border border-white/20 rounded px-3 py-2 text-white"
              placeholder="לדוגמה: פרגולה אשדוד"
            />
            <label className="text-sm text-white/70">תיאור (he)</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="bg-black/30 border border-white/20 rounded px-3 py-2 text-white min-h-[90px]"
              placeholder="אופציונלי"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-white/70">כתובות תמונות (S3) — כל כתובת בשורה</label>
            <textarea
              value={imagesText}
              onChange={(e) => setImagesText(e.target.value)}
              className="bg-black/30 border border-white/20 rounded px-3 py-2 text-white min-h-[140px]"
              placeholder="https://..."
            />
            <button
              onClick={handleCreateProject}
              disabled={creating}
              className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
            >
              {creating ? 'יוצר...' : 'צור פרויקט'}
            </button>
          </div>
        </div>
      </div>

      {/* Projects list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">פרויקטים קיימים</h3>
          <button onClick={loadProjects} disabled={loading} className="text-sm text-blue-400 hover:text-blue-300">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'רענן'}
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="text-white/60 text-sm">אין פרויקטים</p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-white/5 rounded p-3">
                <div>
                  <p className="font-medium">{p.title_he}</p>
                  <p className="text-xs text-white/50">{p.images.length} תמונות</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteProject(p.id, p.title_he, false)}
                    disabled={deletingId === p.id}
                    className="px-3 py-1 text-sm bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 rounded disabled:opacity-50"
                  >
                    מחק מרשימה
                  </button>
                  <button
                    onClick={() => handleDeleteProject(p.id, p.title_he, true)}
                    disabled={deletingId === p.id}
                    className="p-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded disabled:opacity-50"
                    title="מחק + S3"
                  >
                    {deletingId === p.id
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
