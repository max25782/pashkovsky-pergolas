'use client'

import React, { useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Copy } from 'lucide-react'
import type { WorkerShift, WorkerShiftSummary } from '@/types/workers'
import { authFetch } from '@/lib/api/auth-fetch'
import { formatCurrencyILS } from '@/lib/workers/calculations'
import { ShiftForm } from './ShiftForm'

interface TimesheetPanelProps {
  workerId: string
  workerName: string
  month: string
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return '—'
  return timeStr
}

function formatHours(minutes: number | null) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function getDaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const days: string[] = []
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${month}-${String(d).padStart(2, '0')}`)
  }
  return days.reverse() // Newest first
}

export function TimesheetPanel({ workerId, workerName, month }: TimesheetPanelProps) {
  const [shifts, setShifts] = useState<WorkerShift[]>([])
  const [summary, setSummary] = useState<WorkerShiftSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingShift, setEditingShift] = useState<WorkerShift | null>(null)
  const [duplicateFrom, setDuplicateFrom] = useState<WorkerShift | null>(null)
  const [showAllDays, setShowAllDays] = useState(false)

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    try {
      const r = await authFetch(`/api/workers/${workerId}/shifts?month=${month}`)
      if (!r.ok) throw new Error('Failed to fetch shifts')
      const data = await r.json()
      setShifts(data.shifts ?? [])
      setSummary(data.summary ?? null)
    } catch {
      setShifts([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [workerId, month])

  React.useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const fetchLastShift = useCallback(async (): Promise<WorkerShift | null> => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const r = await authFetch(
        `/api/workers/${workerId}/shifts?month=${new Date().toISOString().slice(0, 7)}`
      )
      if (!r.ok) return null
      const { shifts: data } = await r.json()
      const beforeToday = (data ?? []).filter((s: WorkerShift) => s.shiftDate < today)
      beforeToday.sort((a: WorkerShift, b: WorkerShift) => b.shiftDate.localeCompare(a.shiftDate))
      return beforeToday[0] ?? null
    } catch {
      return null
    }
  }, [workerId])

  const handleDelete = async (shiftId: string) => {
    if (!confirm('Delete this shift?')) return
    try {
      const r = await authFetch(`/api/workers/${workerId}/shifts/${shiftId}`, {
        method: 'DELETE',
      })
      if (!r.ok) throw new Error('Failed to delete')
      fetchShifts()
    } catch {
      alert('Failed to delete shift')
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingShift(null)
    setDuplicateFrom(null)
  }

  const handleDuplicate = (shift: WorkerShift) => {
    setDuplicateFrom(shift)
    setEditingShift(null)
    setShowForm(true)
  }

  const initialFormData = duplicateFrom
    ? {
        date: new Date().toISOString().split('T')[0],
        dealId: duplicateFrom.dealId,
        projectName: duplicateFrom.projectName ?? null,
        startTime: duplicateFrom.startTime ?? '08:00',
        endTime: duplicateFrom.endTime ?? '17:00',
        note: duplicateFrom.note,
      }
    : undefined

  return (
    <div className="border-t border-white/10 bg-gray-800/50">
      <div className="p-4">
        {loading ? (
          <div className="text-white/60 py-4">Loading timesheet...</div>
        ) : (
          <>
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 p-3 bg-gray-900/50 rounded">
                <div>
                  <span className="text-white/60 text-sm">Days worked</span>
                  <div className="font-semibold text-white">{summary.daysWorked}</div>
                </div>
                <div>
                  <span className="text-white/60 text-sm">Total hours</span>
                  <div className="font-semibold text-white">{summary.totalHours.toFixed(1)}</div>
                </div>
                <div>
                  <span className="text-white/60 text-sm">Total cost</span>
                  <div className="font-semibold text-white">
                    {formatCurrencyILS(summary.totalCost)}
                  </div>
                </div>
                <div>
                  <span className="text-white/60 text-sm">Late days</span>
                  <div className="font-semibold text-white">{summary.lateDaysCount}</div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <h4 className="font-medium text-white">Daily shifts</h4>
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllDays}
                    onChange={(e) => setShowAllDays(e.target.checked)}
                    className="rounded"
                  />
                  Show all days
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingShift(null)
                  setDuplicateFrom(null)
                  setShowForm(true)
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >
                <Plus className="w-4 h-4" />
                Add shift
              </button>
            </div>

            {showForm && (
              <div className="mb-4">
                <ShiftForm
                  workerId={workerId}
                  month={month}
                  editingShift={editingShift}
                  initialData={initialFormData}
                  onSave={() => {
                    fetchShifts()
                    handleFormClose()
                  }}
                  onCancel={handleFormClose}
                  onCopyYesterday={fetchLastShift}
                />
              </div>
            )}

            {shifts.length === 0 && !showForm ? (
              <div className="text-white/60 py-4 text-center">
                No shifts for this month. Click &quot;Add shift&quot; to add one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-white/60 border-b border-white/10">
                      <th className="py-2 px-2 text-right">Date</th>
                      <th className="py-2 px-2 text-right">Deal</th>
                      <th className="py-2 px-2 text-right">City/Address</th>
                      <th className="py-2 px-2 text-right">Start</th>
                      <th className="py-2 px-2 text-right">End</th>
                      <th className="py-2 px-2 text-right">Hours</th>
                      <th className="py-2 px-2 text-right">Cost</th>
                      <th className="py-2 px-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const shiftByDate = new Map(shifts.map((s) => [s.shiftDate, s]))
                      const daysInMonth = showAllDays ? getDaysInMonth(month) : shifts.map((s) => s.shiftDate).sort((a, b) => b.localeCompare(a))
                      return daysInMonth.map((dateStr) => {
                        const s = shiftByDate.get(dateStr)
                        if (!s) {
                          if (!showAllDays) return null
                          return (
                            <tr key={dateStr} className="border-b border-white/5 text-white/40">
                              <td className="py-2 px-2 text-right">{formatDate(dateStr)}</td>
                              <td colSpan={7} className="py-2 px-2 text-right">
                                —
                              </td>
                            </tr>
                          )
                        }
                        return (
                          <tr
                            key={s.id}
                            className="border-b border-white/5 hover:bg-white/5 bg-white/5"
                          >
                            <td className="py-2 px-2 text-white font-medium">
                              {formatDate(s.shiftDate)}
                            </td>
                            <td className="py-2 px-2 text-white">
                              {s.deal?.customerName ?? s.projectName ?? '—'}
                            </td>
                            <td className="py-2 px-2 text-white/80">
                              {s.deal?.customerCity ?? s.deal?.projectAddress ?? '—'}
                            </td>
                            <td className="py-2 px-2 text-white">{formatTime(s.startTime)}</td>
                            <td className="py-2 px-2 text-white">{formatTime(s.endTime)}</td>
                            <td className="py-2 px-2 text-white">
                              {formatHours(s.minutesWorked)}
                            </td>
                            <td className="py-2 px-2 text-white">
                              {s.computedCost != null
                                ? formatCurrencyILS(s.computedCost)
                                : '—'}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingShift(s)
                                    setDuplicateFrom(null)
                                    setShowForm(true)
                                  }}
                                  className="p-1.5 rounded hover:bg-blue-500/20 text-blue-400"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicate(s)}
                                  className="p-1.5 rounded hover:bg-green-500/20 text-green-400"
                                  title="Duplicate"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(s.id)}
                                  className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
