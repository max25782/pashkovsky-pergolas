'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react'
import Link from 'next/link'
import type { Worker } from '@/types/workers'
import type { Locale } from '@/lib/locales'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

export default function WorkersAdminPage() {
  const t = useCRMTranslations()
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [showInactive, setShowInactive] = useState(false)

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

  const fetchWorkers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/workers?includeInactive=${showInactive}`)
      if (!response.ok) throw new Error('Failed to fetch workers')
      const { workers: workersData } = await response.json()
      setWorkers(workersData || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load workers')
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
      const response = await fetch(`/api/workers/${workerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete worker')

      fetchWorkers()
    } catch (err: any) {
      alert('שגיאה במחיקת עובד: ' + err.message)
    }
  }

  const handleToggleActive = async (worker: Worker) => {
    try {
      const response = await fetch(`/api/workers/${worker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !worker.isActive }),
      })

      if (!response.ok) throw new Error('Failed to update worker')

      fetchWorkers()
    } catch (err: any) {
      alert('שגיאה בעדכון עובד: ' + err.message)
    }
  }

  if (!token) {
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Admin • {t.nav.workers}</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">{t.auth.enterAdminToken}</label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
        <h1 className="text-2xl font-bold">Admin • {t.nav.workers}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`//app/admin/deals`}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href={`//app/admin/leads`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href={`//app/admin/articles`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <Link
            href={`//app/admin/gallery`}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            {t.nav.gallery}
          </Link>
          <Link
            href={`//app/admin/ai-chats`}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {t.nav.aiChats}
          </Link>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
          </button>
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
        <div className="mb-6 flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-white/80">הצג גם עובדים לא פעילים</span>
          </label>
        </div>

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
                    <tr
                      key={worker.id}
                      className="border-b border-white/5 hover:bg-gray-700/30 transition"
                    >
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
      const url = worker ? `/api/workers/${worker.id}` : '/api/workers'
      const method = worker ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save worker')
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

