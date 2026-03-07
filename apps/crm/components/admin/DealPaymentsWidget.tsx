'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/toast'
import { authFetch } from '@/lib/api/auth-fetch'

interface DealPayment {
  id: string
  deal_id: string
  company_id: string
  amount: number
  paid_at: string
  notes?: string | null
  created_at: string
}

interface DealPaymentsWidgetProps {
  dealId: string
  dealPrice: number | null | undefined
  formatCurrency: (amount: number) => string
  translations?: {
    title?: string
    totalPaid?: string
    paidThisMonth?: string
    paidLastMonth?: string
    percentOfPrice?: string
    addPayment?: string
    amount?: string
    paidAt?: string
    notes?: string
    submit?: string
    cancel?: string
    loading?: string
    saving?: string
  }
}

const defaultTranslations = {
  title: 'Payments / תשלומים',
  totalPaid: 'Total Paid / סה"כ שולם',
  paidThisMonth: 'This Month / החודש',
  paidLastMonth: 'Last Month / חודש שעבר',
  percentOfPrice: '% of Price / % מהמחיר',
  addPayment: 'Add Payment / הוסף תשלום',
  amount: 'Amount / סכום',
  paidAt: 'Date / תאריך',
  notes: 'Notes / הערות',
  submit: 'Add / הוסף',
  cancel: 'Cancel / ביטול',
  loading: 'Loading...',
  saving: 'Saving...',
}

export function DealPaymentsWidget({
  dealId,
  dealPrice,
  formatCurrency,
  translations = defaultTranslations,
}: DealPaymentsWidgetProps) {
  const t = { ...defaultTranslations, ...translations }
  const toast = useToast()
  const [payments, setPayments] = useState<DealPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formAmount, setFormAmount] = useState('')
  const [formPaidAt, setFormPaidAt] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  })
  const [formNotes, setFormNotes] = useState('')

  async function fetchPayments() {
    setLoading(true)
    try {
      const res = await authFetch(`/admin-api/deals/${dealId}/payments`)
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err || `Failed to fetch payments: ${res.status}`)
      }
      const data = await res.json()
      setPayments(data.payments ?? [])
    } catch (e) {
      console.error('DealPaymentsWidget fetch error:', e)
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
  }, [dealId])

  async function handleAddPayment() {
    const amount = parseFloat(formAmount)
    if (!Number.isFinite(amount) || amount <= 0) return

    setSubmitting(true)
    try {
      const res = await authFetch(`/admin-api/deals/${dealId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paid_at: new Date(formPaidAt).toISOString(),
          notes: formNotes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to add payment: ${res.status}`)
      }

      setFormAmount('')
      setFormPaidAt(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      })
      setFormNotes('')
      setShowForm(false)
      await fetchPayments()
    } catch (e) {
      console.error('DealPaymentsWidget add error:', e)
      toast.error(e instanceof Error ? e.message : 'Failed to add payment')
    } finally {
      setSubmitting(false)
    }
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  const paidThisMonth = payments
    .filter((p) => new Date(p.paid_at) >= thisMonthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const paidLastMonth = payments
    .filter((p) => {
      const d = new Date(p.paid_at)
      return d >= lastMonthStart && d <= lastMonthEnd
    })
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const priceValue = dealPrice != null && Number.isFinite(dealPrice) ? dealPrice : 0
  const percentOfPrice = priceValue > 0 ? (totalPaid / priceValue) * 100 : 0

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none'
  const labelClass = 'block text-sm font-medium text-white/70 mb-2'

  if (loading) {
    return (
      <div className="pt-4 border-t border-white/10">
        <h3 className="text-lg font-semibold text-white mb-3">{t.title}</h3>
        <div className="text-white/60">{t.loading}</div>
      </div>
    )
  }

  return (
    <div className="pt-4 border-t border-white/10">
      <h3 className="text-lg font-semibold text-white mb-3">{t.title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="text-white/60 text-sm">{t.totalPaid}</div>
          <div className="text-white font-bold">{formatCurrency(totalPaid)}</div>
        </div>
        <div>
          <div className="text-white/60 text-sm">{t.paidThisMonth}</div>
          <div className="text-white font-medium">{formatCurrency(paidThisMonth)}</div>
        </div>
        <div>
          <div className="text-white/60 text-sm">{t.paidLastMonth}</div>
          <div className="text-white font-medium">{formatCurrency(paidLastMonth)}</div>
        </div>
        <div>
          <div className="text-white/60 text-sm">{t.percentOfPrice}</div>
          <div className="text-white font-medium">{percentOfPrice.toFixed(1)}%</div>
        </div>
      </div>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-200 font-medium"
        >
          {t.addPayment}
        </button>
      ) : (
        <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-4">
          <div>
            <label className={labelClass}>
              {t.amount} <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelClass}>{t.paidAt}</label>
            <input
              type="datetime-local"
              value={formPaidAt}
              onChange={(e) => setFormPaidAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{t.notes}</label>
            <input
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              className={inputClass}
              placeholder={t.notes}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddPayment}
              disabled={submitting || !formAmount || parseFloat(formAmount) <= 0}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t.saving : t.submit}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 font-medium"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
