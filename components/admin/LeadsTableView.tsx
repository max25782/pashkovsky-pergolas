"use client"
import { useState } from 'react'
import type { Lead } from './lead-types'
import { LEAD_STATUSES } from './lead-types'
import { formatDate } from './deal-utils'
import { useCRMTranslations } from './useCRMTranslations'

interface LeadsTableViewProps {
  leads: Lead[]
  loading: boolean
  onLeadClick: (lead: Lead) => void
  onLeadDelete: (lead: Lead) => void
  onStatusChange: (lead: Lead, newStatus: string | null) => void
  onNotesChange: (lead: Lead, notes: string | null) => void
}

export function LeadsTableView({
  leads,
  loading,
  onLeadClick,
  onLeadDelete,
  onStatusChange,
  onNotesChange
}: LeadsTableViewProps) {
  const t = useCRMTranslations()
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5">
          <tr>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.leads.createdAt}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.leads.name}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.leads.phone}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.leads.email}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.leads.source}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.leads.status}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.leads.notes}</th>
            <th className="p-3 text-left text-xs font-semibold text-white/70 uppercase">{t.common.delete}</th>
          </tr>
        </thead>
        <tbody>
          {leads.map(lead => (
            <LeadTableRow
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
              onDelete={() => onLeadDelete(lead)}
              onStatusChange={(newStatus) => onStatusChange(lead, newStatus)}
              onNotesChange={(notes) => onNotesChange(lead, notes)}
            />
          ))}
          {leads.length === 0 && !loading && (
            <tr>
              <td className="p-8 text-center text-white/40" colSpan={8}>
                {t.status.noLeads}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function LeadTableRow({
  lead,
  onClick,
  onDelete,
  onStatusChange,
  onNotesChange
}: {
  lead: Lead
  onClick: () => void
  onDelete: () => void
  onStatusChange: (newStatus: string | null) => void
  onNotesChange: (notes: string | null) => void
}) {
  const [localNotes, setLocalNotes] = useState(lead.notes || '')
  const status = LEAD_STATUSES.find(s => s.id === lead.status)

  return (
    <tr 
      className="border-t border-white/5 hover:bg-white/5 transition-colors"
    >
      <td className="p-3 whitespace-nowrap text-white/70 cursor-pointer" onClick={onClick}>
        {formatDate(lead.created_at)}
      </td>
      <td className="p-3 cursor-pointer" onClick={onClick}>
        <div className="font-medium">{lead.name}</div>
        {lead.city && (
          <div className="text-xs text-white/50">{lead.city}</div>
        )}
      </td>
      <td className="p-3 text-white/70 cursor-pointer" onClick={onClick}>{lead.phone}</td>
      <td className="p-3 text-white/70 cursor-pointer" onClick={onClick}>{lead.email || '-'}</td>
      <td className="p-3 text-white/70 cursor-pointer" onClick={onClick}>{lead.source || '-'}</td>
      <td className="p-3">
        <select
          value={lead.status || ''}
          onChange={(e) => {
            const newStatus = e.target.value === '' ? null : e.target.value
            onStatusChange(newStatus)
          }}
          className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        >
          <option value="">-</option>
          {LEAD_STATUSES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </td>
      <td className="p-3 min-w-[220px]">
        <input
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          onBlur={() => {
            if (localNotes !== (lead.notes || '')) {
              onNotesChange(localNotes || null)
            }
          }}
          className="w-full bg-transparent border border-white/20 rounded px-2 py-1 text-sm"
          onClick={(e) => e.stopPropagation()}
          placeholder="Заметки..."
        />
      </td>
      <td className="p-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="px-2 py-1 rounded bg-red-600/20 hover:bg-red-600/30 text-red-200 text-xs"
        >
          Удалить
        </button>
      </td>
    </tr>
  )
}

