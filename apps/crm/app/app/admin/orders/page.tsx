'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/lib/language-context'
import { orderService, type Order, type OrderItem, type UpdateOrderPayload } from '@/lib/api/order-service'
import { ToastContainer, useToast } from '@/components/ui/toast'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditForm {
  status: string
  final_amount: number
  discount_percent: number
  discount_amount: number
  notes: string
  customer_notes: string
  delivery_date: string
  payment_status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending_price: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
  priced:        'bg-blue-500/20 text-blue-300 border-blue-500/50',
  confirmed:     'bg-green-500/20 text-green-300 border-green-500/50',
  in_production: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  ready:         'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
  delivered:     'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
  cancelled:     'bg-red-500/20 text-red-300 border-red-500/50',
}

const STATUS_LABELS: Record<string, Record<string, string>> = {
  pending_price: { ru: 'Ожидает цены',  en: 'Pending Price',  he: 'ממתין למחיר' },
  priced:        { ru: 'Цена задана',    en: 'Priced',         he: 'מחיר הוגדר' },
  confirmed:     { ru: 'Подтверждён',   en: 'Confirmed',      he: 'אושר' },
  in_production: { ru: 'В производстве',en: 'In Production',  he: 'בייצור' },
  ready:         { ru: 'Готов',          en: 'Ready',          he: 'מוכן' },
  delivered:     { ru: 'Доставлен',     en: 'Delivered',      he: 'נמסר' },
  cancelled:     { ru: 'Отменён',       en: 'Cancelled',      he: 'בוטל' },
}

const L = {
  title:         { ru: 'Заказы профилей',    en: 'Profile Orders',   he: 'הזמנות פרופילים' },
  customer:      { ru: 'Клиент',             en: 'Customer',         he: 'לקוח' },
  phone:         { ru: 'Телефон',            en: 'Phone',            he: 'טלפון' },
  email:         { ru: 'Email',              en: 'Email',            he: 'אימייל' },
  city:          { ru: 'Город',              en: 'City',             he: 'עיר' },
  address:       { ru: 'Адрес',              en: 'Address',          he: 'כתובת' },
  items:         { ru: 'Товары',             en: 'Items',            he: 'פריטים' },
  totalWeight:   { ru: 'Общий вес',          en: 'Total Weight',     he: 'משקל כולל' },
  total:         { ru: 'Итого',              en: 'Total',            he: 'סה"כ' },
  edit:          { ru: 'Редактировать',      en: 'Edit',             he: 'ערוך' },
  status:        { ru: 'Статус',             en: 'Status',           he: 'סטטוס' },
  finalAmount:   { ru: 'Итоговая сумма',     en: 'Final Amount',     he: 'סכום סופי' },
  discountPct:   { ru: 'Скидка %',           en: 'Discount %',       he: 'הנחה %' },
  discountAmt:   { ru: 'Скидка (₪)',         en: 'Discount (₪)',     he: 'הנחה (₪)' },
  paymentStatus: { ru: 'Статус оплаты',      en: 'Payment Status',   he: 'סטטוס תשלום' },
  deliveryDate:  { ru: 'Дата доставки',      en: 'Delivery Date',    he: 'תאריך משלוח' },
  notes:         { ru: 'Примечания',         en: 'Notes',            he: 'הערות' },
  customerNotes: { ru: 'Примечания клиента', en: 'Customer Notes',   he: 'הערות לקוח' },
  itemsPrice:    { ru: 'Товары — ₪/кг',      en: 'Items — ₪/kg',    he: 'פריטים — ₪/ק"ג' },
  generatePdf:   { ru: 'Создать PDF',        en: 'Generate PDF',     he: 'צור PDF' },
  save:          { ru: 'Сохранить',          en: 'Save',             he: 'שמור' },
  cancel:        { ru: 'Отмена',             en: 'Cancel',           he: 'ביטול' },
  editOrder:     { ru: 'Редактировать заказ',en: 'Edit Order',       he: 'ערוך הזמנה' },
  noOrders:      { ru: 'Нет заказов',        en: 'No orders',        he: 'אין הזמנות' },
  retry:         { ru: 'Повторить',          en: 'Retry',            he: 'נסה שוב' },
  pending:       { ru: 'Ожидает',            en: 'Pending',          he: 'ממתין' },
  paid:          { ru: 'Оплачено',           en: 'Paid',             he: 'שולם' },
  refunded:      { ru: 'Возврат',            en: 'Refunded',         he: 'הוחזר' },
  color:         { ru: 'Цвет',               en: 'Color',            he: 'גוון' },
}

function t(key: keyof typeof L, lang: string): string {
  const entry = L[key] as Record<string, string>
  return entry?.[lang] ?? entry?.['he'] ?? key
}

function statusLabel(status: string, lang: string): string {
  return STATUS_LABELS[status]?.[lang] ?? status
}

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/50'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const { language } = useLanguage()
  const { toasts, show: showToast, dismiss } = useToast()
  const tCRM = useCRMTranslations()

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setOrders(await orderService.fetchOrders())
    } catch (err) {
      setLoadError((err as Error).message)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadOrders() }, [loadOrders])

  const openEditModal = (order: Order) => {
    setEditingOrder(order)
    setEditForm({
      status:         order.status,
      final_amount:   order.final_amount || order.total_amount || 0,
      discount_percent: 0,
      discount_amount:  0,
      notes:          order.notes ?? '',
      customer_notes: order.customer_notes ?? '',
      delivery_date:  order.delivery_date ?? '',
      payment_status: order.payment_status ?? 'pending',
    })
  }

  const closeEditModal = () => { setEditingOrder(null); setEditForm(null) }

  const handleSaveOrder = async () => {
    if (!editingOrder || !editForm) return
    setSavingOrder(true)
    try {
      const payload: UpdateOrderPayload = {
        status:         editForm.status,
        final_amount:   editForm.final_amount,
        notes:          editForm.notes,
        customer_notes: editForm.customer_notes,
        delivery_date:  editForm.delivery_date || undefined,
        payment_status: editForm.payment_status,
      }
      if (editForm.discount_percent > 0) payload.discount_percent = editForm.discount_percent
      else if (editForm.discount_amount > 0) payload.discount_amount = editForm.discount_amount

      await orderService.updateOrder(editingOrder.id, payload)
      showToast(tCRM.common.save + ' ✓', 'success')
      closeEditModal()
      await loadOrders()
    } catch (err) {
      showToast((err as Error).message, 'error')
    } finally {
      setSavingOrder(false)
    }
  }

  const handleUpdateItemPrice = async (
    orderId: string,
    itemId: string,
    pricePerKg: number,
    color: string,
    weightPerPiece: number,
  ) => {
    try {
      const newPricePerPiece = pricePerKg * weightPerPiece
      await orderService.updateOrderItem(orderId, itemId, { price_per_piece: newPricePerPiece, color: color || 'default' })
      const fresh = await orderService.fetchOrders()
      setOrders(fresh)
      if (editingOrder?.id === orderId) {
        const freshOrder = fresh.find(o => o.id === orderId)
        if (freshOrder) {
          setEditingOrder(freshOrder)
          setEditForm(prev => prev ? { ...prev, final_amount: freshOrder.final_amount ?? freshOrder.total_amount ?? 0 } : prev)
        }
      }
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  const handleGeneratePdf = async (order: Order) => {
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/pdf`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to generate PDF')
      }
      const data = await res.json()
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank')
      } else {
        showToast('PDF נוצר', 'success')
      }
    } catch (err) {
      showToast((err as Error).message, 'error')
    }
  }

  const locale = language === 'he' ? 'he-IL' : language === 'ru' ? 'ru-RU' : 'en-US'

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white/60">{tCRM.common.loading}</p>
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
        <div className="container py-8">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
            <p>{tCRM.common.error}: {loadError}</p>
            <button onClick={loadOrders} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition">
              {t('retry', language)}
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="container py-8">
        <h1 className="text-4xl font-bold mb-8">{t('title', language)}</h1>

        {orders.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center text-white/60">
            {t('noOrders', language)}
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                language={language}
                locale={locale}
                onEdit={openEditModal}
              />
            ))}
          </div>
        )}

        {editingOrder !== null && editForm !== null && (
          <EditModal
            order={editingOrder}
            form={editForm}
            language={language}
            saving={savingOrder}
            onChange={setEditForm}
            onSave={handleSaveOrder}
            onClose={closeEditModal}
            onGeneratePdf={handleGeneratePdf}
            onUpdateItemPrice={handleUpdateItemPrice}
          />
        )}
      </div>
    </main>
  )
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

function OrderCard({ order, language, locale, onEdit }: {
  order: Order
  language: string
  locale: string
  onEdit: (o: Order) => void
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold mb-2">{order.order_number || order.id.slice(0, 8)}</h2>
          <div className="text-sm text-white/60 space-y-1">
            <p><strong>{t('customer', language)}:</strong> {order.customer_name}</p>
            <p><strong>{t('phone', language)}:</strong> {order.customer_phone}</p>
            <p><strong>{t('email', language)}:</strong> {order.customer_email}</p>
            <p><strong>{t('city', language)}:</strong> {order.customer_city}</p>
            {order.delivery_address && (
              <p><strong>{t('address', language)}:</strong> {order.delivery_address}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 rounded border text-sm ${statusColor(order.status)}`}>
            {statusLabel(order.status, language)}
          </span>
          <p className="mt-2 text-lg font-bold">{order.final_amount?.toLocaleString('he-IL')} ₪</p>
          <p className="text-sm text-white/60">{new Date(order.created_at).toLocaleDateString(locale)}</p>
          <button onClick={() => onEdit(order)} className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">
            {t('edit', language)}
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <h3 className="font-semibold mb-2">{t('items', language)}:</h3>
        <div className="space-y-2">
          {order.order_items?.map(item => (
            <div key={item.id} className="flex justify-between text-sm bg-white/5 rounded p-2">
              <div>
                <span className="font-medium">{item.aluminum_profiles?.code || item.profile_id.slice(0, 8)}</span>
                {' – '}{item.length_meters}m × {item.quantity_pieces}
                {item.color !== 'default' && ` (${item.color})`}
              </div>
              <div className="text-white/60">{item.subtotal?.toLocaleString('he-IL')} ₪</div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/10 flex justify-between font-semibold">
          <span>{t('totalWeight', language)}: {order.total_weight_kg?.toFixed(2)} kg</span>
          <span>{t('total', language)}: {order.total_amount?.toLocaleString('he-IL')} ₪</span>
        </div>
      </div>
    </div>
  )
}

// ─── EditModal ────────────────────────────────────────────────────────────────

function EditModal({ order, form, language, saving, onChange, onSave, onClose, onGeneratePdf, onUpdateItemPrice }: {
  order: Order
  form: EditForm
  language: string
  saving: boolean
  onChange: (f: EditForm) => void
  onSave: () => void
  onClose: () => void
  onGeneratePdf: (o: Order) => void
  onUpdateItemPrice: (orderId: string, itemId: string, pricePerKg: number, color: string, weightPerPiece: number) => void
}) {
  const statuses = ['pending_price', 'priced', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold">{t('editOrder', language)}: {order.order_number}</h2>
        </div>

        <div className="p-6 space-y-4">
          {/* Status */}
          <Field label={t('status', language)}>
            <select value={form.status} onChange={e => onChange({ ...form, status: e.target.value })} className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white">
              {statuses.map(s => <option key={s} value={s}>{statusLabel(s, language)}</option>)}
            </select>
          </Field>

          {/* Final Amount */}
          <Field label={`${t('finalAmount', language)} (₪)`}>
            <input type="number" step="0.01" value={form.final_amount}
              onChange={e => onChange({ ...form, final_amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white" />
          </Field>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-4">
            <Field label={t('discountPct', language)}>
              <input type="number" step="0.1" min="0" max="100" value={form.discount_percent}
                onChange={e => {
                  const pct = parseFloat(e.target.value) || 0
                  onChange({ ...form, discount_percent: pct, final_amount: (order.total_amount || 0) * (1 - pct / 100) })
                }}
                className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white" />
            </Field>
            <Field label={t('discountAmt', language)}>
              <input type="number" step="0.01" min="0" value={form.discount_amount}
                onChange={e => {
                  const amt = parseFloat(e.target.value) || 0
                  onChange({ ...form, discount_amount: amt, final_amount: (order.total_amount || 0) - amt })
                }}
                className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white" />
            </Field>
          </div>

          {/* Payment Status */}
          <Field label={t('paymentStatus', language)}>
            <select value={form.payment_status} onChange={e => onChange({ ...form, payment_status: e.target.value })} className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white">
              <option value="pending">{t('pending', language)}</option>
              <option value="paid">{t('paid', language)}</option>
              <option value="refunded">{t('refunded', language)}</option>
            </select>
          </Field>

          {/* Delivery Date */}
          <Field label={t('deliveryDate', language)}>
            <input type="date" value={form.delivery_date} onChange={e => onChange({ ...form, delivery_date: e.target.value })}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white" />
          </Field>

          {/* Notes */}
          <Field label={t('notes', language)}>
            <textarea value={form.notes} onChange={e => onChange({ ...form, notes: e.target.value })} rows={3}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white" />
          </Field>

          {/* Customer Notes */}
          <Field label={t('customerNotes', language)}>
            <textarea value={form.customer_notes} onChange={e => onChange({ ...form, customer_notes: e.target.value })} rows={2}
              className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white" />
          </Field>

          {/* Items — price per kg */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('itemsPrice', language)}</label>
            <div className="space-y-2">
              {order.order_items?.map(item => (
                <ItemPriceRow
                  key={item.id}
                  item={item}
                  language={language}
                  onUpdate={(pricePerKg, color) => onUpdateItemPrice(order.id, item.id, pricePerKg, color, item.weight_per_piece)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-between">
          <button onClick={() => onGeneratePdf(order)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition">
            {t('generatePdf', language)}
          </button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition">
              {t('cancel', language)}
            </button>
            <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition">
              {saving ? '...' : t('save', language)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── ItemPriceRow ─────────────────────────────────────────────────────────────

function ItemPriceRow({ item, language, onUpdate }: {
  item: OrderItem
  language: string
  onUpdate: (pricePerKg: number, color: string) => void
}) {
  const pricePerKg = item.weight_per_piece > 0 ? item.price_per_piece / item.weight_per_piece : 0
  const [localColor, setLocalColor] = useState(item.color === 'default' ? '' : (item.color ?? ''))
  const [localPrice, setLocalPrice] = useState(pricePerKg.toFixed(2))

  const commit = () => {
    const price = parseFloat(localPrice)
    if (!isNaN(price)) onUpdate(price, localColor)
  }

  return (
    <div className="bg-white/5 rounded p-3 space-y-2">
      <div className="text-sm">
        <span className="font-medium">{item.aluminum_profiles?.name_he || item.aluminum_profiles?.code || item.profile_id.slice(0, 8)}</span>
        {item.aluminum_profiles?.code && (
          <span className="text-white/50 font-mono ml-1 text-xs">{item.aluminum_profiles.code}</span>
        )}
        <div className="text-white/50 text-xs mt-0.5">
          {item.length_meters}m × {item.quantity_pieces} · {item.total_weight_kg?.toFixed(2)} kg
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-white/60 text-xs whitespace-nowrap">{t('color', language)}:</span>
          <input
            type="text"
            value={localColor}
            onChange={e => setLocalColor(e.target.value)}
            onBlur={commit}
            placeholder="לבן / שחור / RAL..."
            className="flex-1 px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-sm placeholder:text-white/30"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            step="0.01"
            min="0"
            value={localPrice}
            onChange={e => setLocalPrice(e.target.value)}
            onBlur={commit}
            className="w-24 px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-sm"
          />
          <span className="text-white/60 text-sm">₪/kg</span>
        </div>
      </div>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {children}
    </div>
  )
}
