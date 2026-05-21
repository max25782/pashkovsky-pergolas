"use client"
import { useEffect, useState } from "react"
import type { Lead } from './lead-types'
import { LEAD_STATUSES, pickLabel } from './lead-types'
import { useLanguage } from '@/lib/language-context'
import { formatDate } from './deal-utils'
import { useCRMTranslations } from './useCRMTranslations'
import { LeadScore } from './LeadScore'
import { PhoneActions } from './PhoneActions'

interface LeadModalProps {
  lead: Lead
  onClose: () => void
  onUpdate: (updates: Partial<Lead>) => Promise<Lead>
  onDelete: () => void
  adminToken?: string
}

export function LeadModal({
  lead,
  onClose,
  onUpdate,
  onDelete,
  adminToken
}: LeadModalProps) {
  const t = useCRMTranslations()
  const { language } = useLanguage()
  const [localLead, setLocalLead] = useState(lead)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalLead(lead)
  }, [lead])

  async function handleSave() {
    setSaving(true)
    try {
      // Only send editable form fields (avoid score columns if migration not applied)
      const updates: Partial<Lead> = {
        name: localLead.name,
        phone: localLead.phone,
        email: localLead.email ?? null,
        city: localLead.city ?? null,
        source: localLead.source ?? null,
        status: localLead.status ?? null,
        notes: localLead.notes ?? null,
      }
      await onUpdate(updates)
      onClose()
    } catch (e) {
      console.error('Save error:', e)
    } finally {
      setSaving(false)
    }
  }

  function updateField<K extends keyof Lead>(field: K, value: Lead[K]) {
    setLocalLead(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{t.leads.leadTitle}: {lead.name}</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.leads.name}</label>
              <input
                value={localLead.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.leads.name}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.leads.phone}</label>
              <input
                value={localLead.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="+972..."
              />
              {localLead.phone && (
                <div className="mt-2">
                  <PhoneActions phone={localLead.phone} leadName={localLead.name ?? undefined} variant="full" />
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.leads.email}</label>
              <input
                type="email"
                value={localLead.email || ''}
                onChange={(e) => updateField('email', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.leads.city}</label>
              <input
                value={localLead.city || ''}
                onChange={(e) => updateField('city', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.leads.city}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.leads.source}</label>
              <input
                value={localLead.source || ''}
                onChange={(e) => updateField('source', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
                placeholder={t.leads.source}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">{t.leads.status}</label>
              <select
                value={localLead.status || ''}
                onChange={(e) => updateField('status', (e.target.value || null) as any)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none"
              >
                <option value="">-</option>
                {LEAD_STATUSES.map(s => (
                  <option key={s.id} value={s.id}>{pickLabel(s, language)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* AI Score */}
          <LeadScore
            lead={localLead}
            adminToken={adminToken}
            onScoreUpdated={(updatedLead) => {
              setLocalLead(updatedLead)
            }}
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">{t.leads.notes}</label>
            <textarea
              value={localLead.notes || ''}
              onChange={(e) => updateField('notes', e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none min-h-[120px]"
              placeholder={t.leads.notesPlaceholder}
            />
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-white/10 text-sm text-white/50 space-y-1">
            <div>{t.leads.createdAt}: {formatDate(lead.created_at)}</div>
            {lead.last_message_at && (
              <div>{t.leads.lastMessage}: {formatDate(lead.last_message_at)}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t.common.saving : t.common.save}
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-200 font-semibold"
            >
              {t.common.delete}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 font-semibold"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

