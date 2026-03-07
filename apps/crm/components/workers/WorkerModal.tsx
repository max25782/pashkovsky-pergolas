'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import type { Worker } from '@/types/workers'

interface WorkerFormData {
  firstName: string
  lastName: string
  phone: string
  role: string
  dailyRate: number
  isActive: boolean
}

interface Props {
  worker?: Worker | null
  onClose: () => void
  onSave: () => void
}

export function WorkerModal({ worker, onClose, onSave }: Props) {
  const toast = useToast()
  const [form, setForm] = useState<WorkerFormData>({
    firstName: worker?.firstName ?? '',
    lastName: worker?.lastName ?? '',
    phone: worker?.phone ?? '',
    role: worker?.role ?? '',
    dailyRate: worker?.dailyRate ?? 500,
    isActive: worker?.isActive ?? true,
  })
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof WorkerFormData>(key: K, value: WorkerFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.dailyRate) {
      toast.error('שם פרטי, שם משפחה ותעריף יומי הם שדות חובה')
      return
    }
    if (form.dailyRate <= 0) {
      toast.error('תעריף יומי חייב להיות גדול מ-0')
      return
    }

    setSubmitting(true)
    try {
      if (worker) {
        const res = await authFetch(`/api/workers/${worker.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(data.error ?? 'Failed to update worker')
        }
      } else {
        const res = await authFetch('/api/workers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(data.error ?? 'Failed to create worker')
        }
      }
      onSave()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save worker'
      toast.error(message)
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
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {worker ? 'ערוך עובד' : 'הוסף עובד'}
          </h2>
          <button onClick={onClose} type="button" className="text-white/60 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {[
            { label: 'שם פרטי *', key: 'firstName' as const, type: 'text', required: true },
            { label: 'שם משפחה *', key: 'lastName' as const, type: 'text', required: true },
            { label: 'טלפון', key: 'phone' as const, type: 'tel', required: false },
            { label: 'תפקיד', key: 'role' as const, type: 'text', required: false },
          ].map(({ label, key, type, required }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-white/80 mb-2">{label}</label>
              <input
                type={type}
                value={form[key] as string}
                onChange={(e) => update(key, e.target.value)}
                required={required}
                className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">תעריף יומי (₪) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.dailyRate}
              onChange={(e) => update('dailyRate', parseFloat(e.target.value) || 0)}
              required
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-white/80">עובד פעיל</span>
          </label>

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
              className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
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
