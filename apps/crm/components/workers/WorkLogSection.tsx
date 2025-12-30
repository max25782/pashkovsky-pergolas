'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { AddWorkShiftModal } from './AddWorkShiftModal'
import { groupShiftsByDate, formatCurrencyILS } from '@/lib/workers/calculations'
import type { WorkShift, WorkShiftGroupedByDate } from '@/types/workers'
import { authFetch } from '@/lib/api/auth-fetch'

interface WorkLogSectionProps {
  projectId: string
  onShiftAdded?: () => void
}

export function WorkLogSection({ projectId, onShiftAdded }: WorkLogSectionProps) {
  const [shifts, setShifts] = useState<WorkShift[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await authFetch(`/api/work-shifts?projectId=${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch work shifts')
      const { shifts: shiftsData } = await response.json()
      setShifts(shiftsData || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load work shifts')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק משמרת זו?')) return

    try {
      const response = await authFetch(`/api/work-shifts/${shiftId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete work shift')

      fetchShifts()
      onShiftAdded?.() // Trigger refresh of ProfitWidget
    } catch (err: any) {
      alert('שגיאה במחיקת משמרת: ' + err.message)
    }
  }

  const groupedShifts: WorkShiftGroupedByDate[] = groupShiftsByDate(shifts)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">יומן עבודה</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          type="button"
        >
          <Plus className="w-4 h-4" />
          הוסף משמרת
        </button>
      </div>

      {loading ? (
        <div className="text-white/60 text-center py-8">טוען משמרות...</div>
      ) : error ? (
        <div className="text-red-400 text-center py-8">{error}</div>
      ) : groupedShifts.length === 0 ? (
        <div className="text-white/60 text-center py-8">
          אין משמרות. לחץ על "הוסף משמרת" כדי להתחיל.
        </div>
      ) : (
        <div className="space-y-4">
          {groupedShifts.map((group) => (
            <div
              key={group.date}
              className="bg-gray-900 rounded-lg p-4 border border-white/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-white">
                    {formatDate(group.date)}
                  </span>
                  <span className="text-sm text-white/60">
                    ({group.shifts.length} עובד{group.shifts.length > 1 ? 'ים' : ''})
                  </span>
                </div>
                <span className="text-lg font-bold text-green-400">
                  {formatCurrencyILS(group.totalDailyRate)}
                </span>
              </div>

              <div className="space-y-2">
                {group.shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between bg-gray-800/50 rounded p-3"
                  >
                    <div className="flex-1">
                      <div className="text-white font-medium">
                        {shift.worker
                          ? `${shift.worker.firstName} ${shift.worker.lastName}`
                          : 'Unknown worker'}
                        {shift.worker?.role && (
                          <span className="text-white/60 text-sm mr-2">
                            ({shift.worker.role})
                          </span>
                        )}
                      </div>
                      {shift.notes && (
                        <div className="text-white/60 text-sm mt-1">{shift.notes}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white font-semibold">
                        {formatCurrencyILS(shift.dailyRateSnapshot)}
                      </span>
                      <button
                        onClick={() => handleDeleteShift(shift.id)}
                        className="p-2 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition"
                        type="button"
                        title="מחק משמרת"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddWorkShiftModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        onShiftAdded={() => {
          fetchShifts()
          onShiftAdded?.()
        }}
      />
    </div>
  )
}






