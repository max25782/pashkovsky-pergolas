'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import type { Worker, WorkShiftDraft } from '@/types/workers'
import { authFetch } from '@/lib/api/auth-fetch'

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
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<WorkShiftDraft>({
    projectId,
    workerId: '',
    date: new Date().toISOString().split('T')[0], // Today's date
    payType: 'daily',
    dailyRateSnapshot: 0,
    notes: '',
  })

  // Fetch workers
  useEffect(() => {
    if (isOpen) {
      fetchWorkers()
    }
  }, [isOpen])

  const fetchWorkers = async () => {
    try {
      setLoading(true)
      const response = await authFetch('/api/workers')
      if (!response.ok) throw new Error('Failed to fetch workers')
      const { workers: workersData } = await response.json()
      setWorkers(workersData || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load workers')
    } finally {
      setLoading(false)
    }
  }

  // Update dailyRateSnapshot when worker is selected
  useEffect(() => {
    if (formData.workerId) {
      const worker = workers.find((w) => w.id === formData.workerId)
      if (worker) {
        setFormData((prev) => ({
          ...prev,
          dailyRateSnapshot: worker.dailyRate,
        }))
      }
    }
  }, [formData.workerId, workers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.workerId || !formData.date || !formData.dailyRateSnapshot) {
      setError('Please fill all required fields')
      return
    }

    try {
      setSubmitting(true)
      const response = await authFetch('/api/work-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create work shift')
      }

      // Reset form
      setFormData({
        projectId,
        workerId: '',
        date: new Date().toISOString().split('T')[0],
        payType: 'daily',
        dailyRateSnapshot: 0,
        notes: '',
      })

      onShiftAdded()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create work shift')
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
          <h2 className="text-2xl font-bold text-white">הוסף משמרת</h2>
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
              עובד *
            </label>
            {loading ? (
              <div className="text-white/60 text-sm">טוען עובדים...</div>
            ) : (
              <select
                value={formData.workerId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, workerId: e.target.value }))
                }
                className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">בחר עובד</option>
                {workers
                  .filter((w) => w.isActive)
                  .map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.firstName} {worker.lastName}
                      {worker.role ? ` - ${worker.role}` : ''} ({worker.dailyRate} ₪/יום)
                    </option>
                  ))}
              </select>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              תאריך *
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

          {/* Daily Rate Snapshot */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              תעריף יומי (₪) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.dailyRateSnapshot || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  dailyRateSnapshot: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-white/60 mt-1">
              ברירת מחדל: תעריף העובד. ניתן לשנות רק עבור משמרת זו (כל סכום חיובי).
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              הערות (אופציונלי)
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
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.workerId || !formData.date}
              className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


