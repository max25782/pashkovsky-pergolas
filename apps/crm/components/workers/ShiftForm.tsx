'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Save, X } from 'lucide-react'
import type { WorkerShiftDraft, WorkerShift } from '@/types/workers'
import { authFetch } from '@/lib/api/auth-fetch'

const TIME_PRESETS = [
  { label: '07:00–16:00', start: '07:00', end: '16:00' },
  { label: '08:00–17:00', start: '08:00', end: '17:00' },
  { label: '08:00–18:00', start: '08:00', end: '18:00' },
  { label: '09:00–17:00', start: '09:00', end: '17:00' },
] as const

interface DealOption {
  id: string
  customer_name?: string | null
  customer_city?: string | null
  stage?: string | null
}

interface ShiftFormProps {
  workerId: string
  month: string
  editingShift?: WorkerShift | null
  initialData?: Partial<WorkerShiftDraft>
  onSave: () => void
  onCancel: () => void
  onCopyYesterday?: () => Promise<WorkerShift | null>
}

export function ShiftForm({
  workerId,
  month,
  editingShift,
  initialData,
  onSave,
  onCancel,
  onCopyYesterday,
}: ShiftFormProps) {
  const today = new Date().toISOString().split('T')[0]
  const [deals, setDeals] = useState<DealOption[]>([])
  const [dealsLoading, setDealsLoading] = useState(false)
  const [dealsError, setDealsError] = useState<string | null>(null)
  const [dealSearch, setDealSearch] = useState('')
  const [showDealDropdown, setShowDealDropdown] = useState(false)

  const [formData, setFormData] = useState<WorkerShiftDraft>({
    date: initialData?.date ?? today,
    dealId: initialData?.dealId ?? null,
    projectName: initialData?.projectName ?? null,
    startTime: initialData?.startTime ?? '08:00',
    endTime: initialData?.endTime ?? '17:00',
    note: initialData?.note ?? '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDeals = useCallback(async () => {
    setDealsLoading(true)
    setDealsError(null)
    try {
      const r = await authFetch('/admin-api/deals?limit=200')
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? `Failed to fetch deals (${r.status})`)
      }
      const { data } = await r.json()
      setDeals(Array.isArray(data) ? data : [])
    } catch (e) {
      setDeals([])
      setDealsError(e instanceof Error ? e.message : 'Failed to load deals')
    } finally {
      setDealsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  useEffect(() => {
    if (editingShift) {
      setFormData({
        date: editingShift.shiftDate,
        dealId: editingShift.dealId,
        projectName: editingShift.projectName ?? null,
        startTime: editingShift.startTime ?? '08:00',
        endTime: editingShift.endTime ?? '17:00',
        note: editingShift.note ?? '',
      })
      setDealSearch(editingShift.projectName ?? (editingShift.deal?.customerName ?? ''))
    } else if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
        date: initialData.date ?? prev.date,
        projectName: initialData.projectName ?? prev.projectName,
        startTime: initialData.startTime ?? prev.startTime,
        endTime: initialData.endTime ?? prev.endTime,
      }))
      if (initialData.projectName) setDealSearch(initialData.projectName)
    }
  }, [editingShift, initialData])

  const openDeals = deals.filter((d) => d.stage !== 'done')
  const filteredDeals = dealSearch
    ? openDeals.filter(
        (d) =>
          (d.customer_name ?? '').toLowerCase().includes(dealSearch.toLowerCase()) ||
          (d.customer_city ?? '').toLowerCase().includes(dealSearch.toLowerCase())
      )
    : openDeals

  const selectedDeal = formData.dealId
    ? deals.find((d) => d.id === formData.dealId)
    : null

  const handleCopyYesterday = async () => {
    if (!onCopyYesterday) return
    setError(null)
    try {
      const last = await onCopyYesterday()
      if (last) {
        setFormData({
          date: today,
          dealId: last.dealId,
          projectName: last.projectName ?? null,
          startTime: last.startTime ?? '08:00',
          endTime: last.endTime ?? '17:00',
          note: last.note ?? '',
        })
        setDealSearch(last.projectName ?? last.deal?.customerName ?? '')
      } else {
        setError('No previous shift found')
      }
    } catch {
      setError('No previous shift found')
    }
  }

  const handlePreset = (start: string, end: string) => {
    setFormData((prev) => ({ ...prev, startTime: start, endTime: end }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const hasStart = formData.startTime != null && formData.startTime !== ''
    const hasEnd = formData.endTime != null && formData.endTime !== ''
    if (hasStart !== hasEnd) {
      setError('Both start and end time are required when one is provided')
      return
    }
    if (hasStart && hasEnd) {
      const [sh, sm] = formData.startTime!.split(':').map(Number)
      const [eh, em] = formData.endTime!.split(':').map(Number)
      const startMin = sh * 60 + sm
      const endMin = eh * 60 + em
      if (endMin <= startMin) {
        setError('End time must be after start time (no overnight shifts)')
        return
      }
    }

    try {
      setSubmitting(true)
      const payload = {
        date: formData.date,
        dealId: formData.dealId || null,
        projectName: formData.projectName?.trim() || null,
        startTime: hasStart ? formData.startTime : null,
        endTime: hasEnd ? formData.endTime : null,
        note: formData.note || null,
      }

      if (editingShift) {
        const r = await authFetch(
          `/api/workers/${workerId}/shifts/${editingShift.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        )
        if (!r.ok) {
          const err = await r.json()
          throw new Error(err.error ?? 'Failed to update')
        }
      } else {
        const r = await authFetch(`/api/workers/${workerId}/shifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!r.ok) {
          const err = await r.json()
          throw new Error(err.error ?? 'Failed to save')
        }
      }
      onSave()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-white/10">
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {formData.dealId == null && !formData.projectName?.trim() && (
        <div className="p-2 bg-amber-500/20 border border-amber-500/50 rounded text-amber-200 text-sm">
          No deal linked
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">Date</label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
            required
          />
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-white/80 mb-1">Deal / Project</label>
          <input
            type="text"
            value={
              showDealDropdown
                ? dealSearch
                : formData.dealId
                  ? selectedDeal?.customer_name ?? ''
                  : formData.projectName ?? dealSearch
            }
            onChange={(e) => {
              const v = e.target.value
              setDealSearch(v)
              setShowDealDropdown(true)
              if (!v.trim()) setFormData((p) => ({ ...p, dealId: null, projectName: null }))
            }}
            onFocus={() => setShowDealDropdown(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowDealDropdown(false)
                if (dealSearch.trim() && !formData.dealId) {
                  setFormData((p) => ({ ...p, projectName: dealSearch.trim(), dealId: null }))
                }
              }, 200)
            }}
            placeholder="Search deals or type custom..."
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          />
          {showDealDropdown && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-gray-800 border border-white/20 rounded shadow-lg">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-white/80 hover:bg-white/10 text-sm"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setFormData((p) => ({ ...p, dealId: null, projectName: null }))
                  setDealSearch('')
                  setShowDealDropdown(false)
                }}
              >
                No deal
              </button>
              {dealSearch.trim() && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-blue-300 hover:bg-white/10 text-sm border-b border-white/10"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setFormData((p) => ({ ...p, dealId: null, projectName: dealSearch.trim() }))
                    setShowDealDropdown(false)
                  }}
                >
                  Use &quot;{dealSearch.trim().slice(0, 40)}
                  {dealSearch.length > 40 ? '...' : ''}&quot; (custom)
                </button>
              )}
              {dealsLoading ? (
                <div className="px-3 py-2 text-white/60 text-sm">Loading...</div>
              ) : dealsError ? (
                <div className="px-3 py-2 text-amber-300 text-sm">{dealsError}</div>
              ) : filteredDeals.length === 0 ? (
                <div className="px-3 py-2 text-white/60 text-sm">No deals found</div>
              ) : (
                filteredDeals.slice(0, 30).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="w-full px-3 py-2 text-left text-white hover:bg-white/10 text-sm"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setFormData((p) => ({ ...p, dealId: d.id, projectName: null }))
                      setDealSearch('')
                      setShowDealDropdown(false)
                    }}
                  >
                    {d.customer_name ?? d.id}
                    {d.customer_city ? ` (${d.customer_city})` : ''}
                  </button>
                ))
              )}
            </div>
          )}
          {dealsError && !showDealDropdown && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-amber-300 text-sm">{dealsError}</span>
              <button
                type="button"
                onClick={() => fetchDeals()}
                className="text-blue-300 text-sm hover:underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">Start</label>
          <input
            type="time"
            value={formData.startTime ?? ''}
            onChange={(e) => setFormData((p) => ({ ...p, startTime: e.target.value }))}
            step={300}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1">End</label>
          <input
            type="time"
            value={formData.endTime ?? ''}
            onChange={(e) => setFormData((p) => ({ ...p, endTime: e.target.value }))}
            step={300}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TIME_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => handlePreset(p.start, p.end)}
            className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      {onCopyYesterday && (
        <button
          type="button"
          onClick={handleCopyYesterday}
          className="px-3 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm"
        >
          Copy yesterday
        </button>
      )}

      <div>
        <label className="block text-sm font-medium text-white/80 mb-1">Note (optional)</label>
        <textarea
          value={formData.note ?? ''}
          onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
          rows={2}
          className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white resize-none"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
