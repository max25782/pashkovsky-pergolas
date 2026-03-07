'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import type { Worker } from '@/types/workers'

interface Props {
  workers: Worker[]
  onApplied: () => void
  onCancel: () => void
}

interface Deal {
  id: string
  customer_name?: string
}

export function BulkPlanForm({ workers, onApplied, onCancel }: Props) {
  const toast = useToast()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [date, setDate] = useState(tomorrow.toISOString().split('T')[0])
  const [dealId, setDealId] = useState<string | null>(null)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('17:00')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deals, setDeals] = useState<Deal[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    authFetch('/admin-api/deals?limit=200')
      .then((r) => r.json())
      .then((d: { data?: Deal[] }) => setDeals(d.data ?? []))
      .catch(() => setDeals([]))
  }, [])

  function toggleWorker(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleApply() {
    if (selectedIds.size === 0) { toast.error('Select at least one worker'); return }
    setSubmitting(true)
    try {
      const res = await authFetch('/api/shifts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          deal_id: dealId ?? null,
          start_time: startTime,
          end_time: endTime,
          worker_ids: Array.from(selectedIds),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to apply')
      }
      onApplied()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-white/10">
      <h3 className="font-semibold text-white mb-4">Bulk apply shift</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Date', type: 'date', value: date, onChange: setDate },
          { label: 'Start', type: 'time', value: startTime, onChange: setStartTime },
          { label: 'End', type: 'time', value: endTime, onChange: setEndTime },
        ].map(({ label, type, value, onChange }) => (
          <div key={label}>
            <label className="block text-sm text-white/80 mb-1">{label}</label>
            <input
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              step={type === 'time' ? 300 : undefined}
              className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm text-white/80 mb-1">Deal</label>
          <select
            value={dealId ?? ''}
            onChange={(e) => setDealId(e.target.value || null)}
            className="w-full px-3 py-2 rounded bg-white/10 border border-white/20 text-white"
          >
            <option value="">No deal</option>
            {deals.filter((d) => d.id).map((d) => (
              <option key={d.id} value={d.id}>{d.customer_name ?? d.id}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/80">Workers</span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set(workers.filter((w) => w.isActive).map((w) => w.id)))}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Select all active
          </button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
          {workers.filter((w) => w.isActive).map((w) => (
            <label key={w.id} className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.has(w.id)}
                onChange={() => toggleWorker(w.id)}
                className="rounded"
              />
              <span className="text-white text-sm">{w.firstName} {w.lastName}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white">
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
