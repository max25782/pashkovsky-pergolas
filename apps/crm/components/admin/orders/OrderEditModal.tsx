'use client'

import { useState } from 'react'
import { OrderItemPriceRow } from './OrderItemPriceRow'
import type { Order, OrderEditForm, OrderStatus, PaymentStatus } from './order-types'

type Language = 'ru' | 'en' | 'he'

interface Props {
  order: Order
  language: Language
  getStatusLabel: (status: string) => string
  onClose: () => void
  onSave: (orderId: string, form: OrderEditForm) => Promise<void>
  onUpdateItemPrice: (orderId: string, itemId: string, pricePerPiece: number, color: string) => Promise<void>
  onGeneratePdf: (order: Order) => Promise<void>
}

export function OrderEditModal({
  order,
  language,
  getStatusLabel,
  onClose,
  onSave,
  onUpdateItemPrice,
  onGeneratePdf,
}: Props) {
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

  const statusOptions: OrderStatus[] = [
    'pending_price', 'priced', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled',
  ]

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
            {language === 'ru' ? 'Редактировать заказ' : language === 'en' ? 'Edit Order' : 'ערוך הזמנה'}:{' '}
            {order.order_number}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ru' ? 'Статус' : language === 'en' ? 'Status' : 'סטטוס'}
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as OrderStatus })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>{getStatusLabel(s)}</option>
              ))}
            </select>
          </div>

          {/* Final Amount */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ru' ? 'Итоговая сумма' : language === 'en' ? 'Final Amount' : 'סכום סופי'} (₪)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.final_amount}
              onChange={(e) => setForm({ ...form, final_amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                {language === 'ru' ? 'Скидка %' : language === 'en' ? 'Discount %' : 'הנחה %'}
              </label>
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
              <label className="block text-sm font-medium mb-2">
                {language === 'ru' ? 'Скидка (₪)' : language === 'en' ? 'Discount (₪)' : 'הנחה (₪)'}
              </label>
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

          {/* Payment Status */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ru' ? 'Статус оплаты' : language === 'en' ? 'Payment Status' : 'סטטוס תשלום'}
            </label>
            <select
              value={form.payment_status}
              onChange={(e) => setForm({ ...form, payment_status: e.target.value as PaymentStatus })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            >
              <option value="pending">{language === 'ru' ? 'Ожидает' : language === 'en' ? 'Pending' : 'ממתין'}</option>
              <option value="paid">{language === 'ru' ? 'Оплачено' : language === 'en' ? 'Paid' : 'שולם'}</option>
              <option value="refunded">{language === 'ru' ? 'Возврат' : language === 'en' ? 'Refunded' : 'הוחזר'}</option>
            </select>
          </div>

          {/* Delivery Date */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ru' ? 'Дата доставки' : language === 'en' ? 'Delivery Date' : 'תאריך משלוח'}
            </label>
            <input
              type="date"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ru' ? 'Примечания' : language === 'en' ? 'Notes' : 'הערות'}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          {/* Customer Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ru' ? 'Примечания клиента' : language === 'en' ? 'Customer Notes' : 'הערות לקוח'}
            </label>
            <textarea
              value={form.customer_notes}
              onChange={(e) => setForm({ ...form, customer_notes: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
            />
          </div>

          {/* Order Items */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ru' ? 'Товары — цена за кг' : language === 'en' ? 'Items — price per kg' : 'פריטים — מחיר לק"ג'}
            </label>
            <div className="space-y-2">
              {order.order_items?.map((item) => (
                <OrderItemPriceRow
                  key={item.id}
                  item={item}
                  orderId={order.id}
                  onUpdate={onUpdateItemPrice}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-between">
          <button
            onClick={() => onGeneratePdf(order)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition"
          >
            {language === 'ru' ? 'Создать PDF' : language === 'en' ? 'Generate PDF' : 'צור PDF'}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
            >
              {language === 'ru' ? 'Отмена' : language === 'en' ? 'Cancel' : 'ביטול'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition disabled:opacity-50"
            >
              {saving
                ? (language === 'ru' ? 'Сохраняем...' : language === 'en' ? 'Saving...' : 'שומר...')
                : (language === 'ru' ? 'Сохранить' : language === 'en' ? 'Save' : 'שמור')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
