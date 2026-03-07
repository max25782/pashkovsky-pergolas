'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar } from 'lucide-react'
import Link from 'next/link'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { WorkersTable } from '@/components/workers/WorkersTable'
import { WorkerModal } from '@/components/workers/WorkerModal'
import { BulkPlanForm } from '@/components/workers/BulkPlanForm'
import { TimesheetPanel } from '@/components/workers/TimesheetPanel'
import type { Worker } from '@/types/workers'

export default function WorkersAdminPage() {
  const t = useCRMTranslations()
  const toast = useToast()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [planTomorrow, setPlanTomorrow] = useState(false)

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true)
      const url = showInactive ? '/api/workers?includeInactive=true' : '/api/workers'
      const res = await authFetch(url)
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to fetch workers')
      }
      const data = await res.json() as { workers?: Worker[] }
      setWorkers(data.workers ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load workers'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [showInactive])

  useEffect(() => { fetchWorkers() }, [fetchWorkers])

  async function handleDelete(workerId: string) {
    if (!confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) return
    try {
      const res = await authFetch(`/api/workers/${workerId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to delete')
      }
      toast.success('עובד נמחק בהצלחה')
      fetchWorkers()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete worker'
      toast.error(message)
    }
  }

  async function handleToggleActive(worker: Worker) {
    try {
      const res = await authFetch(`/api/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !worker.isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to update')
      }
      fetchWorkers()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update worker'
      toast.error(message)
    }
  }

  function handleToggleExpand(id: string) {
    setExpandedWorkerId((prev) => (prev === id ? null : id))
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.nav.workers}</h1>
        <nav className="flex gap-2 flex-wrap">
          <Link href="/app/admin/deals" className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold">{t.nav.deals}</Link>
          <Link href="/app/admin/leads" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold">{t.nav.leads}</Link>
          <Link href="/app/admin/articles" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold">{t.nav.articles}</Link>
          <Link href="/app/admin/gallery" className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold">{t.nav.gallery}</Link>
          <Link href="/app/admin/ai-chats" className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold">{t.nav.aiChats}</Link>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">ניהול עובדים</h2>
            <p className="text-white/60">הוסף, ערוך ומחק עובדים</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            type="button"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
          >
            <Plus className="w-5 h-5" />
            הוסף עובד
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-white/80">הצג גם עובדים לא פעילים</span>
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white/60" />
            <label htmlFor="month-select" className="text-white/80 text-sm">חודש:</label>
            <input
              id="month-select"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="px-3 py-1.5 rounded bg-white/10 border border-white/20 text-white"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={planTomorrow}
              onChange={(e) => setPlanTomorrow(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-white/80">תכנן מחר (החלה מרובה)</span>
          </label>
        </div>

        {planTomorrow && (
          <BulkPlanForm
            workers={workers}
            onApplied={() => { setPlanTomorrow(false); setExpandedWorkerId(null) }}
            onCancel={() => setPlanTomorrow(false)}
          />
        )}

        {loading ? (
          <div className="text-center py-12 text-white/60">טוען עובדים...</div>
        ) : workers.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            אין עובדים. לחץ על &quot;הוסף עובד&quot; כדי להתחיל.
          </div>
        ) : (
          <WorkersTable
            workers={workers}
            expandedWorkerId={expandedWorkerId}
            onToggleExpand={handleToggleExpand}
            onEdit={setEditingWorker}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
            renderTimesheetPanel={(worker) => (
              <TimesheetPanel
                workerId={worker.id}
                workerName={`${worker.firstName} ${worker.lastName}`}
                month={month}
              />
            )}
          />
        )}

        {(showAddModal || editingWorker !== null) && (
          <WorkerModal
            worker={editingWorker}
            onClose={() => { setShowAddModal(false); setEditingWorker(null) }}
            onSave={() => { fetchWorkers(); setShowAddModal(false); setEditingWorker(null) }}
          />
        )}
      </div>
    </main>
  )
}
