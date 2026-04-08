'use client'

import React from 'react'
import { ChevronDown, ChevronRight, Edit2, Trash2 } from 'lucide-react'
import type { Worker } from '@/types/workers'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

interface Props {
  workers: Worker[]
  expandedWorkerId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (worker: Worker) => void
  onDelete: (id: string) => void
  onToggleActive: (worker: Worker) => void
  renderTimesheetPanel: (worker: Worker) => React.ReactNode
}

export function WorkersTable({
  workers,
  expandedWorkerId,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleActive,
  renderTimesheetPanel,
}: Props) {
  const t = useCRMTranslations()

  return (
    <div className="bg-gray-800 rounded-lg border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-2 py-3 w-8" />
              <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">{t.workers.colName}</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">{t.workers.colRole}</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">{t.workers.colPhone}</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-white/80">{t.workers.colDailyRate}</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white/80">{t.workers.colStatus}</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-white/80">{t.workers.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <React.Fragment key={worker.id}>
                <tr className="border-b border-white/5 hover:bg-gray-700/30 transition">
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => onToggleExpand(worker.id)}
                      className="p-1 rounded hover:bg-white/10 text-white/60"
                    >
                      {expandedWorkerId === worker.id
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {worker.firstName} {worker.lastName}
                  </td>
                  <td className="px-4 py-3 text-white/60">{worker.role || '—'}</td>
                  <td className="px-4 py-3 text-white/60">{worker.phone || '—'}</td>
                  <td className="px-4 py-3 font-semibold">₪{worker.dailyRate.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onToggleActive(worker)}
                      type="button"
                      className={`px-3 py-1 rounded text-sm font-medium transition ${
                        worker.isActive
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      }`}
                    >
                      {worker.isActive ? t.workers.active : t.workers.inactive}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onEdit(worker)}
                        type="button"
                        className="p-2 rounded hover:bg-blue-500/20 text-blue-400 transition"
                        title={t.common.edit}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(worker.id)}
                        type="button"
                        className="p-2 rounded hover:bg-red-500/20 text-red-400 transition"
                        title={t.common.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedWorkerId === worker.id && (
                  <tr>
                    <td colSpan={7} className="p-0 border-b border-white/5">
                      {renderTimesheetPanel(worker)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
