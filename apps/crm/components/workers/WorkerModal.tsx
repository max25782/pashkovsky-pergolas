'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import type { Worker } from '@/types/workers'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

// The subcontractor's price is agreed per job, so it is typed in by hand
// (no prefilled default) and stored in the same daily_rate column that all
// shift-cost calculations already read.
const SUBCONTRACTOR_ROLE = 'קבלן משנה'
const DEFAULT_DAILY_RATE = 500
// Same defaults as lib/workers/employer-cost.ts, repeated here only to keep
// this client component free of server-side imports.
const DEFAULT_EMPLOYER_COEFFICIENT = 25
const DEFAULT_PENSION_RATE = 12.5

interface WorkerFormData {
  firstName: string
  lastName: string
  phone: string
  role: string
  dailyRate: number
  isActive: boolean
  employerCoefficient: number
  pensionRate: number
  pensionExempt: boolean
}

interface Props {
  worker?: Worker | null
  onClose: () => void
  onSave: () => void
}

const inputClass =
  'w-full min-h-11 px-3 py-2.5 rounded bg-white/10 border border-white/20 text-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500'

export function WorkerModal({ worker, onClose, onSave }: Props) {
  const toast = useToast()
  const t = useCRMTranslations()
  const [form, setForm] = useState<WorkerFormData>({
    firstName: worker?.firstName ?? '',
    lastName: worker?.lastName ?? '',
    phone: worker?.phone ?? '',
    role: worker?.role ?? '',
    dailyRate: worker?.dailyRate ?? DEFAULT_DAILY_RATE,
    isActive: worker?.isActive ?? true,
    employerCoefficient: worker?.employerCoefficient ?? DEFAULT_EMPLOYER_COEFFICIENT,
    pensionRate: worker?.pensionRate ?? DEFAULT_PENSION_RATE,
    pensionExempt: worker?.pensionExempt ?? false,
  })
  const [submitting, setSubmitting] = useState(false)

  function update<K extends keyof WorkerFormData>(key: K, value: WorkerFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.dailyRate) {
      toast.error(t.workers.requiredFields)
      return
    }
    if (form.dailyRate <= 0) {
      toast.error(t.workers.dailyRatePositive)
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

  const ROLE_OPTIONS = [
    'קבלן',
    SUBCONTRACTOR_ROLE,
    'עובד',
    'מנהל',
    'נהג',
    'מעצב',
    'אחר',
  ]

  const isCustomRole = form.role !== '' && !ROLE_OPTIONS.includes(form.role)
  const selectValue = isCustomRole ? 'אחר' : form.role
  const isSubcontractor = form.role === SUBCONTRACTOR_ROLE

  const textFields: { label: string; key: keyof WorkerFormData; type: string; required: boolean }[] = [
    { label: t.workers.firstName, key: 'firstName', type: 'text', required: true },
    { label: t.workers.lastName, key: 'lastName', type: 'text', required: true },
    { label: t.workers.phone, key: 'phone', type: 'tel', required: false },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="worker-modal-title"
        className="flex max-h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-white/20 bg-gray-800 shadow-2xl sm:max-h-[min(90dvh,720px)] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
          <h2 id="worker-modal-title" className="text-lg font-bold text-white sm:text-2xl">
            {worker ? t.workers.editTitle : t.workers.addTitle}
          </h2>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            aria-label={t.common.cancel}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:space-y-4 sm:px-6 sm:py-5">
            {textFields.map(({ label, key, type, required }) => (
              <div key={key}>
                <label className="mb-1.5 block text-sm font-medium text-white/80">{label}</label>
                <input
                  type={type}
                  value={form[key] as string}
                  onChange={(e) => update(key, e.target.value)}
                  required={required}
                  className={inputClass}
                />
              </div>
            ))}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">{t.workers.role}</label>
              <select
                value={selectValue}
                onChange={(e) => {
                  if (e.target.value === 'אחר') {
                    update('role', '')
                  } else {
                    update('role', e.target.value)
                    // New subcontractor: drop the generic default so the price is entered manually.
                    if (e.target.value === SUBCONTRACTOR_ROLE && !worker && form.dailyRate === DEFAULT_DAILY_RATE) {
                      update('dailyRate', 0)
                    }
                  }
                }}
                className={inputClass}
              >
                <option value="">— בחר תפקיד —</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {(selectValue === 'אחר' || isCustomRole) && (
                <input
                  type="text"
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  placeholder="הכנס תפקיד..."
                  className={`mt-2 ${inputClass}`}
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {isSubcontractor ? 'מחיר קבלן משנה (₪) — הזנה ידנית' : t.workers.dailyRate}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder={isSubcontractor ? 'הכנס מחיר...' : undefined}
                value={form.dailyRate === 0 ? '' : form.dailyRate}
                onChange={(e) => update('dailyRate', parseFloat(e.target.value) || 0)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t.workers.employerCoefficient}
              </label>
              <input
                type="number"
                min="0"
                max="200"
                step="0.1"
                inputMode="decimal"
                value={form.employerCoefficient}
                onChange={(e) => update('employerCoefficient', parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
              <p className="mt-1 text-xs leading-snug text-white/50">{t.workers.employerCoefficientHint}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/80">
                {t.workers.pensionRate}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                inputMode="decimal"
                value={form.pensionRate}
                disabled={form.pensionExempt}
                onChange={(e) => update('pensionRate', parseFloat(e.target.value) || 0)}
                className={`${inputClass} disabled:opacity-40`}
              />
            </div>

            <label className="flex min-h-11 items-center gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={form.pensionExempt}
                onChange={(e) => update('pensionExempt', e.target.checked)}
                className="h-5 w-5 shrink-0 rounded"
              />
              <span className="text-sm text-white/80">{t.workers.pensionExempt}</span>
            </label>

            <label className="flex min-h-11 items-center gap-3 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => update('isActive', e.target.checked)}
                className="h-5 w-5 shrink-0 rounded"
              />
              <span className="text-sm text-white/80">{t.workers.isActive}</span>
            </label>
          </div>

          <div className="flex shrink-0 gap-3 border-t border-white/10 bg-gray-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-11 flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4 shrink-0" />
              {submitting ? t.workers.saving : t.common.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
