'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { authFetch } from '@/lib/api/auth-fetch'

interface PlannedPayment {
  id: string
  amount: number | string
  due_date: string | null
  label: string | null
}

interface PlannedPaymentsWidgetProps {
  dealId: string
  formatCurrency: (amount: number) => string
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none'
const labelClass = 'block text-sm font-medium text-white/70 mb-2'

function formatDay(value: string): string {
  const [y, m, d] = value.split('-')
  return `${d}.${m}.${y}`
}

/**
 * Stage payments a firm expects for a deal. They are what the weekly owner report
 * compares with the money that actually arrived (deal_payments).
 */
export function PlannedPaymentsWidget({ dealId, formatCurrency }: PlannedPaymentsWidgetProps) {
  const t = useTranslations('deals')
  const toast = useToast()
  const [rows, setRows] = useState<PlannedPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [label, setLabel] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/admin-api/deals/${dealId}/planned-payments`)
      if (!res.ok) throw new Error(`Failed to load planned payments: ${res.status}`)
      const data = (await res.json()) as { plannedPayments?: PlannedPayment[] }
      setRows(data.plannedPayments ?? [])
    } catch (error) {
      console.error('PlannedPaymentsWidget load error:', error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    void load()
  }, [load])

  async function add() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return
    setSaving(true)
    try {
      const res = await authFetch(`/admin-api/deals/${dealId}/planned-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value, due_date: dueDate || null, label: label.trim() || null }),
      })
      if (!res.ok) throw new Error(`Failed to save planned payment: ${res.status}`)
      setAmount('')
      setDueDate('')
      setLabel('')
      setShowForm(false)
      await load()
    } catch (error) {
      console.error('PlannedPaymentsWidget add error:', error)
      toast.error(t('plannedFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setDeletingId(id)
    try {
      const res = await authFetch(`/admin-api/deals/${dealId}/planned-payments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Failed to delete planned payment: ${res.status}`)
      await load()
    } catch (error) {
      console.error('PlannedPaymentsWidget delete error:', error)
      toast.error(t('plannedFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0)

  return (
    <div className="pt-4 border-t border-white/10">
      <h3 className="text-lg font-semibold text-white mb-1">{t('plannedPayments')}</h3>
      <p className="mb-3 text-sm text-white/50">{t('plannedPaymentsHint')}</p>

      {loading ? null : (
        <>
          {rows.length > 0 && (
            <div className="mb-3 space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-white font-semibold">{formatCurrency(Number(row.amount))}</span>
                    <span className="text-white/50 text-sm">
                      {row.due_date ? formatDay(row.due_date) : t('plannedNoDate')}
                    </span>
                    {row.label && <span className="text-white/40 text-sm truncate max-w-[160px]">{row.label}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(row.id)}
                    disabled={deletingId === row.id}
                    className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-red-400 transition-colors disabled:opacity-50"
                    aria-label="Delete"
                  >
                    {deletingId === row.id ? '…' : '🗑️'}
                  </button>
                </div>
              ))}
              <div className="text-sm text-white/60">
                {t('plannedTotal')}: <span className="text-white font-medium">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 font-medium"
            >
              {t('addPlannedPayment')}
            </button>
          ) : (
            <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-4">
              <div>
                <label className={labelClass}>{t('plannedAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelClass}>{t('plannedDueDate')}</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('plannedLabel')}</label>
                <input
                  value={label}
                  maxLength={120}
                  onChange={(e) => setLabel(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void add()}
                  disabled={saving || !amount || Number(amount) <= 0}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('addPlannedPayment')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
