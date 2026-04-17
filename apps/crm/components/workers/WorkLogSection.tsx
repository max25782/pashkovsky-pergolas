'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import { Plus, Trash2 } from 'lucide-react'
import { AddWorkShiftModal } from './AddWorkShiftModal'
import { formatCurrencyILS } from '@/lib/workers/calculations'
import { authFetch } from '@/lib/api/auth-fetch'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useLanguage } from '@/lib/language-context'

interface DealShift {
  id: string
  workerId: string
  shiftDate: string
  startTime: string | null
  endTime: string | null
  minutesWorked: number | null
  computedCost: number | null
  note: string | null
  worker?: { id: string; firstName: string; lastName: string; role?: string }
}

interface WorkLogSectionProps {
  projectId: string
  onShiftAdded?: () => void
  /** Increment to open the add-shift modal from parent (e.g. quick action). */
  openModalSignal?: number
  /** Override empty list copy (e.g. “No work days yet”). */
  emptyMessage?: string
}

function groupByDate(shifts: DealShift[]) {
  const map = new Map<string, DealShift[]>()
  for (const s of shifts) {
    const d = s.shiftDate
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(s)
  }
  return Array.from(map.entries())
    .map(([date, items]) => ({ date, shifts: items }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

const LOCALE_MAP: Record<string, string> = { ru: 'ru-RU', en: 'en-US', he: 'he-IL' }

export function WorkLogSection({
  projectId,
  onShiftAdded,
  openModalSignal = 0,
  emptyMessage,
}: WorkLogSectionProps) {
  const toast = useToast()
  const t = useCRMTranslations()
  const { language } = useLanguage()
  const dateLocale = LOCALE_MAP[language] ?? 'en-US'
  const [shifts, setShifts] = useState<DealShift[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchShifts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await authFetch(`/api/deals/${projectId}/labor?includeShifts=true`)
      if (!response.ok) throw new Error('Failed to fetch work shifts')
      const data = await response.json()
      setShifts(data.shifts || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load work shifts')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchShifts()
  }, [fetchShifts])

  useEffect(() => {
    if (openModalSignal > 0) {
      setIsModalOpen(true)
    }
  }, [openModalSignal])

  const handleDeleteShift = async (shiftId: string, workerId: string) => {
    if (!confirm(t.workers.deleteShiftConfirm)) return

    try {
      const response = await authFetch(`/api/workers/${workerId}/shifts/${shiftId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete work shift')

      fetchShifts()
      onShiftAdded?.()
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : 'Unknown'))
    }
  }

  const groupedShifts = groupByDate(shifts)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">{t.workers.workLog}</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          type="button"
        >
          <Plus className="w-4 h-4" />
          {t.workers.addShift}
        </button>
      </div>

      {loading ? (
        <div className="text-white/60 text-center py-8">{t.workers.loadingShifts}</div>
      ) : error ? (
        <div className="text-red-400 text-center py-8">{error}</div>
      ) : groupedShifts.length === 0 ? (
        <div className="text-white/60 text-center py-8">
          {emptyMessage ?? t.workers.noShifts}
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
                    ({group.shifts.length} {group.shifts.length > 1 ? t.workers.workers_plural : t.workers.worker})
                  </span>
                </div>
                <span className="text-lg font-bold text-green-400">
                  {formatCurrencyILS(
                    group.shifts.reduce((s, x) => s + (x.computedCost ?? 0), 0)
                  )}
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
                        {(shift.startTime || shift.endTime) && (
                          <span className="text-white/60 text-sm mr-2">
                            {shift.startTime ?? '—'}–{shift.endTime ?? '—'}
                          </span>
                        )}
                      </div>
                      {shift.note && (
                        <div className="text-white/60 text-sm mt-1">{shift.note}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-white font-semibold">
                        {shift.computedCost != null
                          ? formatCurrencyILS(shift.computedCost)
                          : '—'}
                      </span>
                      <button
                        onClick={() => handleDeleteShift(shift.id, shift.workerId)}
                        className="p-2 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition"
                        type="button"
                        title={t.common.delete}
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






