'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, X, Save, ChevronDown, ChevronRight, Calendar } from 'lucide-react'
import Link from 'next/link'
import type { Worker } from '@/types/workers'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { authFetch } from '@/lib/api/auth-fetch'
import { TimesheetPanel } from '@/components/workers/TimesheetPanel'

export default function WorkersAdminPage() {
  const t = useCRMTranslations()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [planTomorrow, setPlanTomorrow] = useState(false)

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const url = showInactive
        ? '/api/workers?includeInactive=true'
        : '/api/workers'
      const r = await authFetch(url)
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to fetch workers')
      }
      const { workers: data } = await r.json()
      setWorkers(data ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load workers')
    } finally {
      setLoading(false)
    }
  }, [showInactive])

  useEffect(() => {
    fetchWorkers()
  }, [fetchWorkers])

  const handleDelete = async (workerId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק עובד זה?')) return

    try {
      const r = await authFetch(`/api/workers/${workerId}`, { method: 'DELETE' })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to delete')
      }
      fetchWorkers()
    } catch (err: unknown) {
      alert('שגיאה במחיקת עובד: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  const handleToggleActive = async (worker: Worker) => {
    try {
      const r = await authFetch(`/api/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !worker.isActive }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to update')
      }
      fetchWorkers()
    } catch (err: unknown) {
      alert('שגיאה בעדכון עובד: ' + (err instanceof Error ? err.message : 'Unknown'))
    }
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.nav.workers}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app/admin/deals"
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href="/app/admin/leads"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href="/app/admin/articles"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <Link
            href="/app/admin/gallery"
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            {t.nav.gallery}
          </Link>
          <Link
            href="/app/admin/ai-chats"
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {t.nav.aiChats}
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold mb-2">ניהול עובדים</h2>
            <p className="text-white/60">הוסף, ערוך ומחק עובדים</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
            type="button"
          >
            <Plus className="w-5 h-5" />
            הוסף עובד
          </button>
        </div>

        {/* Filters */}
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
            <label htmlFor="month-select" className="text-white/80 text-sm">
              חודש:
            </label>
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
            onApplied={() => {
              setPlanTomorrow(false)
              setExpandedWorkerId(null)
            }}
            onCancel={() => setPlanTomorrow(false)}
          />
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded text-red-200">
            {error}
          </div>
        )}

        {/* Workers Table */}
        {loading ? (
          <div className="text-center py-12 text-white/60">טוען עובדים...</div>
        ) : workers.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            אין עובדים. לחץ על "הוסף עובד" כדי להתחיל.
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-2 py-3 w-8" />
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                      שם
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                      תפקיד
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                      טלפון
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">
                      תעריף יומי (₪)
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white/80">
                      סטטוס
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-white/80">
                      פעולות
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((worker) => (
                    <React.Fragment key={worker.id}>
                      <tr
                        className="border-b border-white/5 hover:bg-gray-700/30 transition"
                      >
                        <td className="px-2 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedWorkerId((id) =>
                                id === worker.id ? null : worker.id
                              )
                            }
                            className="p-1 rounded hover:bg-white/10 text-white/60"
                          >
                            {expandedWorkerId === worker.id ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {worker.firstName} {worker.lastName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/60">
                          {worker.role || '—'}
                        </td>
                        <td className="px-4 py-3 text-white/60">
                          {worker.phone || '—'}
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          ₪{worker.dailyRate.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleActive(worker)}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              worker.isActive
                                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                            }`}
                            type="button"
                          >
                            {worker.isActive ? 'פעיל' : 'לא פעיל'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingWorker(worker)}
                              className="p-2 rounded hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition"
                              type="button"
                              title="ערוך"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(worker.id)}
                              className="p-2 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition"
                              type="button"
                              title="מחק"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedWorkerId === worker.id && (
                        <tr>
                          <td colSpan={7} className="p-0 border-b border-white/5">
                            <TimesheetPanel
                              workerId={worker.id}
                              workerName={`${worker.firstName} ${worker.lastName}`}
                              month={month}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {(showAddModal || editingWorker) && (
          <WorkerModal
            worker={editingWorker}
            onClose={() => {
              setShowAddModal(false)
              setEditingWorker(null)
            }}
            onSave={() => {
              fetchWorkers()
              setShowAddModal(false)
              setEditingWorker(null)
            }}
          />
        )}
      </div>
    </main>
  )
}

interface BulkPlanFormProps {
  workers: Worker[]
  onApplied: () => void
  onCancel: () => void
}

function BulkPlanForm({ workers, onApplied, onCancel }: BulkPlanFormProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDate = tomorrow.toISOString().split('T')[0]

  const [date, setDate] = useState(defaultDate)
  const [dealId, setDealId] = useState<string | null>(null)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deals, setDeals] = useState<Array<{ id: string; customer_name?: string }>>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    authFetch('/admin-api/deals?limit=200')
      .then((r) => r.json())
      .then((d) => setDeals(d.data ?? []))
      .catch(() => setDeals([]))
  }, [])

  const toggleWorker = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(workers.filter((w) => w.isActive).map((w) => w.id)))
  }

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      setError('Select at least one worker')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const r = await authFetch('/api/shifts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          deal_id: dealId || null,
          start_time: startTime,
          end_time: endTime,
          worker_ids: Array.from(selectedIds),
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to apply')
      }
      onApplied()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-white/10">
      <h3 className="font-semibold text-white mb-4">Bulk apply shift</h3>
      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm text-white/80 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-white/80 mb-1">Deal</label>
          <select
            value={dealId ?? ''}
            onChange={(e) => setDealId(e.target.value || null)}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          >
            <option value="">No deal</option>
            {deals
              .filter((d) => d.id)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.customer_name ?? d.id}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-white/80 mb-1">Start</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            step={300}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-white/80 mb-1">End</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            step={300}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          />
        </div>
      </div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/80">Workers</span>
          <button
            type="button"
            onClick={selectAll}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Select all active
          </button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {workers
            .filter((w) => w.isActive)
            .map((w) => (
              <label
                key={w.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(w.id)}
                  onChange={() => toggleWorker(w.id)}
                  className="rounded"
                />
                <span className="text-white text-sm">
                  {w.firstName} {w.lastName}
                </span>
              </label>
            ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={submitting || selectedIds.size === 0}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
        >
          {submitting ? 'Applying...' : `Apply to ${selectedIds.size} workers`}
        </button>
      </div>
    </div>
  )
}

interface WorkerModalProps {
  worker?: Worker | null
  onClose: () => void
  onSave: () => void
}

function WorkerModal({ worker, onClose, onSave }: WorkerModalProps) {
  const [formData, setFormData] = useState({
    firstName: worker?.firstName || '',
    lastName: worker?.lastName || '',
    phone: worker?.phone || '',
    role: worker?.role || '',
    dailyRate: worker?.dailyRate || 500,
    isActive: worker?.isActive !== undefined ? worker.isActive : true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.firstName || !formData.lastName || !formData.dailyRate) {
      setError('שם פרטי, שם משפחה ותעריף יומי הם שדות חובה')
      return
    }

    if (formData.dailyRate <= 0) {
      setError('תעריף יומי חייב להיות גדול מ-0')
      return
    }

    try {
      setSubmitting(true)
      
      if (worker) {
        const r = await authFetch(`/api/workers/${worker.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            role: formData.role,
            dailyRate: formData.dailyRate,
            isActive: formData.isActive,
          }),
        })
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.error ?? 'Failed to update worker')
        }
      } else {
        // Create new worker - use API to include company_id
        const response = await authFetch('/api/workers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create worker')
        }
      }

      onSave()
    } catch (err: any) {
      setError(err.message || 'Failed to save worker')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-white/20 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {worker ? 'ערוך עובד' : 'הוסף עובד'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              שם פרטי *
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, firstName: e.target.value }))
              }
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              שם משפחה *
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, lastName: e.target.value }))
              }
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              טלפון
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, phone: e.target.value }))
              }
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              תפקיד
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Daily Rate */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              תעריף יומי (₪) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.dailyRate}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  dailyRate: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-white/60 mt-1">
              תעריף יומי (נטו) - כל סכום חיובי
            </p>
          </div>

          {/* Is Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
              }
              className="w-4 h-4 rounded"
            />
            <label htmlFor="isActive" className="text-sm text-white/80 cursor-pointer">
              עובד פעיל
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

