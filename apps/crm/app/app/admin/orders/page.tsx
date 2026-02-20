'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useLanguage } from '@/lib/language-context'

interface OrderItem {
  id: string
  profile_id: string
  color: string
  length_meters: number
  quantity_pieces: number
  weight_per_piece: number
  total_weight_kg: number
  price_per_piece: number
  subtotal: number
  aluminum_profiles?: {
    id: string
    code: string
    name_he: string
    name_ru?: string
    name_en?: string
  }
}

interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_city: string
  status: string
  total_weight_kg: number
  total_amount: number
  final_amount: number
  delivery_address: string
  source: string
  created_at: string
  order_items: OrderItem[]
  notes?: string
  customer_notes?: string
  delivery_date?: string
  payment_status?: string
}

export default function OrdersPage() {
  const { language } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editForm, setEditForm] = useState<{
    status: string
    final_amount: number
    discount_percent: number
    discount_amount: number
    notes: string
    customer_notes: string
    delivery_date: string
    payment_status: string
  } | null>(null)

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    try {
      setLoading(true)
      setError(null)
      
      const response = await authFetch('/api/admin/orders')
      
      if (!response.ok) {
        throw new Error(`Failed to load orders: ${response.statusText}`)
      }
      
      const data = await response.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (err: any) {
      console.error('[Orders] Error loading:', err)
      setError(err.message || 'Failed to load orders')
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_price':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
      case 'priced':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50'
      case 'confirmed':
        return 'bg-green-500/20 text-green-300 border-green-500/50'
      case 'preparing':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50'
      case 'ready':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
      case 'delivered':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/50'
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, Record<string, string>> = {
      pending_price: { ru: 'Ожидает цены', en: 'Pending Price', he: 'ממתין למחיר' },
      priced: { ru: 'Цена установлена', en: 'Priced', he: 'מחיר הוגדר' },
      confirmed: { ru: 'Подтвержден', en: 'Confirmed', he: 'אושר' },
      preparing: { ru: 'Готовится', en: 'Preparing', he: 'בהכנה' },
      ready: { ru: 'Готов', en: 'Ready', he: 'מוכן' },
      delivered: { ru: 'Доставлен', en: 'Delivered', he: 'נמסר' },
      cancelled: { ru: 'Отменен', en: 'Cancelled', he: 'בוטל' },
    }
    return labels[status]?.[language] || status
  }

  function openEditModal(order: Order) {
    setEditingOrder(order)
    setEditForm({
      status: order.status,
      final_amount: order.final_amount || order.total_amount || 0,
      discount_percent: 0,
      discount_amount: 0,
      notes: order.notes || '',
      customer_notes: order.customer_notes || '',
      delivery_date: order.delivery_date || '',
      payment_status: order.payment_status || 'pending',
    })
  }

  async function handleSaveOrder() {
    if (!editingOrder || !editForm) return

    try {
      const response = await authFetch(`/api/admin/orders/${editingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })

      if (!response.ok) {
        throw new Error('Failed to update order')
      }

      await loadOrders()
      setEditingOrder(null)
      setEditForm(null)
    } catch (err: any) {
      console.error('[Orders] Error updating:', err)
      alert(err.message || 'Failed to update order')
    }
  }

  async function handleUpdateItemPrice(orderId: string, itemId: string, newPrice: number) {
    try {
      const response = await authFetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_per_piece: newPrice }),
      })

      if (!response.ok) {
        throw new Error('Failed to update item price')
      }

      await loadOrders()
    } catch (err: any) {
      console.error('[Orders] Error updating item:', err)
      alert(err.message || 'Failed to update item price')
    }
  }

  async function handleGeneratePdf(order: Order) {
    try {
      const response = await authFetch(`/api/admin/orders/${order.id}/pdf`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to generate PDF' }))
        throw new Error(error.error || 'Failed to generate PDF')
      }

      const data = await response.json()
      if (data.pdfUrl) {
        // Open PDF in new window
        window.open(data.pdfUrl, '_blank')
      } else {
        alert(language === 'ru' ? 'PDF создан, но URL не получен' : language === 'en' ? 'PDF generated but no URL returned' : 'PDF נוצר אך לא הוחזר קישור')
      }
    } catch (err: any) {
      console.error('[Orders] Error generating PDF:', err)
      alert(err.message || (language === 'ru' ? 'Ошибка создания PDF' : language === 'en' ? 'Error generating PDF' : 'שגיאה ביצירת PDF'))
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
        <div className="container py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white/60">Loading orders...</p>
          </div>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
        <div className="container py-8">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
            <p>Error: {error}</p>
            <button
              onClick={loadOrders}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">
            {language === 'ru' ? 'Заказы профилей' : language === 'en' ? 'Profile Orders' : 'הזמנות פרופילים'}
          </h1>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center text-white/60">
            {language === 'ru' ? 'Нет заказов' : language === 'en' ? 'No orders' : 'אין הזמנות'}
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white/5 border border-white/10 rounded-lg p-6 hover:bg-white/10 transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold mb-2">
                      {order.order_number || order.id.slice(0, 8)}
                    </h2>
                    <div className="text-sm text-white/60 space-y-1">
                      <p>
                        <strong>{language === 'ru' ? 'Клиент:' : language === 'en' ? 'Customer:' : 'לקוח:'}</strong>{' '}
                        {order.customer_name}
                      </p>
                      <p>
                        <strong>{language === 'ru' ? 'Телефон:' : language === 'en' ? 'Phone:' : 'טלפון:'}</strong>{' '}
                        {order.customer_phone}
                      </p>
                      <p>
                        <strong>{language === 'ru' ? 'Email:' : language === 'en' ? 'Email:' : 'אימייל:'}</strong>{' '}
                        {order.customer_email}
                      </p>
                      <p>
                        <strong>{language === 'ru' ? 'Город:' : language === 'en' ? 'City:' : 'עיר:'}</strong>{' '}
                        {order.customer_city}
                      </p>
                      {order.delivery_address && (
                        <p>
                          <strong>{language === 'ru' ? 'Адрес:' : language === 'en' ? 'Address:' : 'כתובת:'}</strong>{' '}
                          {order.delivery_address}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded border text-sm ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    <p className="mt-2 text-lg font-bold">
                      {order.final_amount?.toLocaleString('he-IL')} ₪
                    </p>
                    <p className="text-sm text-white/60">
                      {new Date(order.created_at).toLocaleDateString(language === 'he' ? 'he-IL' : language === 'ru' ? 'ru-RU' : 'en-US')}
                    </p>
                    <button
                      onClick={() => openEditModal(order)}
                      className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
                    >
                      {language === 'ru' ? 'Редактировать' : language === 'en' ? 'Edit' : 'ערוך'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <h3 className="font-semibold mb-2">
                    {language === 'ru' ? 'Товары:' : language === 'en' ? 'Items:' : 'פריטים:'}
                  </h3>
                  <div className="space-y-2">
                    {order.order_items?.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm bg-white/5 rounded p-2">
                        <div>
                          <span className="font-medium">
                            {item.aluminum_profiles?.code || item.profile_id.slice(0, 8)}
                          </span>
                          {' - '}
                          {item.length_meters}m × {item.quantity_pieces}
                          {item.color !== 'default' && ` (${item.color})`}
                        </div>
                        <div className="text-white/60">
                          {item.subtotal?.toLocaleString('he-IL')} ₪
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 flex justify-between font-semibold">
                    <span>
                      {language === 'ru' ? 'Общий вес:' : language === 'en' ? 'Total Weight:' : 'משקל כולל:'}{' '}
                      {order.total_weight_kg?.toFixed(2)} kg
                    </span>
                    <span>
                      {language === 'ru' ? 'Итого:' : language === 'en' ? 'Total:' : 'סה"כ:'}{' '}
                      {order.total_amount?.toLocaleString('he-IL')} ₪
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Modal */}
        {editingOrder && editForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <h2 className="text-2xl font-bold">
                  {language === 'ru' ? 'Редактировать заказ' : language === 'en' ? 'Edit Order' : 'ערוך הזמנה'}: {editingOrder.order_number}
                </h2>
              </div>

              <div className="p-6 space-y-4">
                {/* Status */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ru' ? 'Статус' : language === 'en' ? 'Status' : 'סטטוס'}
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
                  >
                    <option value="pending_price">{getStatusLabel('pending_price')}</option>
                    <option value="priced">{getStatusLabel('priced')}</option>
                    <option value="confirmed">{getStatusLabel('confirmed')}</option>
                    <option value="preparing">{getStatusLabel('preparing')}</option>
                    <option value="ready">{getStatusLabel('ready')}</option>
                    <option value="delivered">{getStatusLabel('delivered')}</option>
                    <option value="cancelled">{getStatusLabel('cancelled')}</option>
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
                    value={editForm.final_amount}
                    onChange={(e) => setEditForm({ ...editForm, final_amount: parseFloat(e.target.value) || 0 })}
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
                      value={editForm.discount_percent}
                      onChange={(e) => {
                        const percent = parseFloat(e.target.value) || 0
                        const baseAmount = editingOrder.total_amount || 0
                        setEditForm({
                          ...editForm,
                          discount_percent: percent,
                          final_amount: baseAmount * (1 - percent / 100),
                        })
                      }}
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
                      value={editForm.discount_amount}
                      onChange={(e) => {
                        const amount = parseFloat(e.target.value) || 0
                        const baseAmount = editingOrder.total_amount || 0
                        setEditForm({
                          ...editForm,
                          discount_amount: amount,
                          final_amount: baseAmount - amount,
                        })
                      }}
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
                    value={editForm.payment_status}
                    onChange={(e) => setEditForm({ ...editForm, payment_status: e.target.value })}
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
                    value={editForm.delivery_date}
                    onChange={(e) => setEditForm({ ...editForm, delivery_date: e.target.value })}
                    className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ru' ? 'Примечания' : language === 'en' ? 'Notes' : 'הערות'}
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
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
                    value={editForm.customer_notes}
                    onChange={(e) => setEditForm({ ...editForm, customer_notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 bg-black/30 border border-white/20 rounded text-white"
                  />
                </div>

                {/* Order Items */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {language === 'ru' ? 'Товары' : language === 'en' ? 'Items' : 'פריטים'}
                  </label>
                  <div className="space-y-2">
                    {editingOrder.order_items?.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-white/5 rounded p-3">
                        <div className="flex-1">
                          <span className="font-medium">
                            {item.aluminum_profiles?.code || item.profile_id.slice(0, 8)}
                          </span>
                          {' - '}
                          {item.length_meters}m × {item.quantity_pieces}
                          {item.color !== 'default' && ` (${item.color})`}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={item.price_per_piece}
                            onBlur={(e) => {
                              const newPrice = parseFloat(e.target.value)
                              if (!isNaN(newPrice) && newPrice !== item.price_per_piece) {
                                handleUpdateItemPrice(editingOrder.id, item.id, newPrice)
                              }
                            }}
                            className="w-24 px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-sm"
                          />
                          <span className="text-white/60">₪</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex justify-between">
                <button
                  onClick={() => handleGeneratePdf(editingOrder)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition"
                >
                  {language === 'ru' ? 'Создать PDF' : language === 'en' ? 'Generate PDF' : 'צור PDF'}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingOrder(null)
                      setEditForm(null)
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition"
                  >
                    {language === 'ru' ? 'Отмена' : language === 'en' ? 'Cancel' : 'ביטול'}
                  </button>
                  <button
                    onClick={handleSaveOrder}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition"
                  >
                    {language === 'ru' ? 'Сохранить' : language === 'en' ? 'Save' : 'שמור'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
