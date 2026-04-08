'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Worker } from '@/types/workers'
import { authFetch } from '@/lib/api/auth-fetch'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

interface AddWorkShiftModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onShiftAdded: () => void
}

export function AddWorkShiftModal({
  isOpen,
  onClose,
  projectId,
  onShiftAdded,
}: AddWorkShiftModalProps) {
  const t = useCRMTranslations()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    workerId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '17:00',
    notes: '',
  })

  useEffect(() => {
    if (isOpen) {
      authFetch('/api/workers')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to fetch'))))
        .then((d) => setWorkers(d.workers ?? []))
        .catch(() => setWorkers([]))
        .finally(() => setLoading(false))
      setLoading(true)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.workerId || !formData.date) {
      setError('Please select worker and date')
      return
    }

    try {
      setSubmitting(true)
      const response = await authFetch(`/api/workers/${formData.workerId}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formData.date,
          dealId: projectId,
          startTime: formData.startTime,
          endTime: formData.endTime,
          note: formData.notes || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create work shift')
      }

      setFormData({
        workerId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '17:00',
        notes: '',
      })

      onShiftAdded()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create work shift')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">{t.workers.addShiftTitle}</h2>
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

          {/* Worker Select */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t.workers.workerLabel}
            </label>
            {loading ? (
              <div className="text-white/60 text-sm">{t.workers.loadingWorkers}</div>
            ) : (
              <select
                value={formData.workerId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, workerId: e.target.value }))
                }
                className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">{t.workers.selectWorker}</option>
                {workers
                  .filter((w) => w.isActive)
                  .map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.firstName} {worker.lastName}
                      {worker.role ? ` - ${worker.role}` : ''} ({worker.dailyRate} {t.workers.perDay})
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t.workers.dateLabel}
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, date: e.target.value }))
              }
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {t.workers.startLabel}
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startTime: e.target.value }))
                }
                step={300}
                className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                {t.workers.endLabel}
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, endTime: e.target.value }))
                }
                step={300}
                className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t.workers.notesLabel}
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.workerId || !formData.date || !formData.startTime || !formData.endTime}
              className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t.workers.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


