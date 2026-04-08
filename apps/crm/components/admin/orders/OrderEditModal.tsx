'use client'

import { useState } from 'react'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useTranslations } from 'next-intl'
import { ORDER_STATUSES, getStatusLabel } from './order-constants'
import { OrderItemPriceRow } from './OrderItemPriceRow'
import type { Language } from './order-constants'
import type { Order, OrderEditForm, OrderStatus, PaymentStatus } from './order-types'

interface Props {
  order: Order
  lang: Language
  onClose: () => void
  onSave: (orderId: string, form: OrderEditForm) => Promise<void>
  onUpdateItemPrice: (orderId: string, itemId: string, pricePerPiece: number, color: string) => Promise<void>
}

export function OrderEditModal({ order, lang, onClose, onSave, onUpdateItemPrice }: Props) {
  const t = useCRMTranslations()
  const tOrders = useTranslations('orders')

  const [form, setForm] = useState<OrderEditForm>({
    status: order.status,
    final_amount: order.final_amount ?? order.total_amount ?? 0,
    discount_percent: 0,
    discount_amount: 0,
    notes: order.notes ?? '',
    customer_notes: order.customer_notes ?? '',
    delivery_date: order.delivery_date ?? '',
    payment_status: order.payment_status ?? 'pending',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave(order.id, form)
    setSaving(false)
  }

  function applyDiscountPercent(percent: number) {
    const base = order.total_amount ?? 0
    setForm((prev) => ({
      ...prev,
      discount_percent: percent,
      discount_amount: 0,
      final_amount: base * (1 - percent / 100),
    }))
  }

  function applyDiscountAmount(amount: number) {
    const base = order.total_amount ?? 0
    setForm((prev) => ({
      ...prev,
      discount_amount: amount,
      discount_percent: 0,
      final_amount: base - amount,
    }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold">
            {tOrders('editOrder')}: {order.order_number}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{tOrders('status')}</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{getStatusLabel(s, lang)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{tOrders('finalAmountLabel')} (₪)</label>
            <input
              type="number"
              step="0.01"
              value={form.final_amount}
              onChange={(e) => setForm({ ...form, final_amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">{tOrders('discountPercent')}</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={form.discount_percent}
                onChange={(e) => applyDiscountPercent(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{tOrders('discountAmount')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.discount_amount}
                onChange={(e) => applyDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{tOrders('paymentStatus')}</label>
            <select
              value={form.payment_status}
              onChange={(e) => setForm({ ...form, payment_status: e.target.value as PaymentStatus })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            >
              <option value="pending">{tOrders('paymentStatuses.pending')}</option>
              <option value="paid">{tOrders('paymentStatuses.paid')}</option>
              <option value="refunded">{tOrders('paymentStatuses.refunded')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{tOrders('deliveryDate')}</label>
            <input
              type="date"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{tOrders('notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{tOrders('customerNotes')}</label>
            <textarea
              value={form.customer_notes}
              onChange={(e) => setForm({ ...form, customer_notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{tOrders('itemsPricePerKg')}</label>
            <div className="space-y-2">
              {order.order_items?.map((item) => (
                <OrderItemPriceRow
                  key={item.id}
                  item={item}
                  orderId={order.id}
                  lang={lang}
                  onUpdate={onUpdateItemPrice}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
          >
            {saving ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  )
}
