'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useLanguage } from '@/lib/language-context'
import { useToast } from '@/components/ui/toast'
import { OrderCard } from '@/components/admin/orders/OrderCard'
import { OrderEditModal } from '@/components/admin/orders/OrderEditModal'
import type { Order, OrderEditForm } from '@/components/admin/orders/order-types'

type Language = 'ru' | 'en' | 'he'

const STATUS_COLORS: Record<string, string> = {
  pending_price: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
  priced: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
  confirmed: 'bg-green-500/20 text-green-300 border-green-500/50',
  preparing: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
  ready: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
  delivered: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/50',
}

const STATUS_LABELS: Record<string, Record<Language, string>> = {
  pending_price: { ru: 'Ожидает цены', en: 'Pending Price', he: 'ממתין למחיר' },
  priced: { ru: 'Цена установлена', en: 'Priced', he: 'מחיר הוגדר' },
  confirmed: { ru: 'Подтвержден', en: 'Confirmed', he: 'אושר' },
  preparing: { ru: 'Готовится', en: 'Preparing', he: 'בהכנה' },
  ready: { ru: 'Готов', en: 'Ready', he: 'מוכן' },
  delivered: { ru: 'Доставлен', en: 'Delivered', he: 'נמסר' },
  cancelled: { ru: 'Отменен', en: 'Cancelled', he: 'בוטל' },
}

export default function OrdersPage() {
  const { language } = useLanguage()
  const toast = useToast()
  const lang = language as Language

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  const getStatusColor = (status: string) => STATUS_COLORS[status] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/50'
  const getStatusLabel = (status: string) => STATUS_LABELS[status]?.[lang] ?? status

  async function loadOrders() {
    try {
      setLoading(true)
      const res = await authFetch('/api/admin/orders')
      if (!res.ok) throw new Error(`Failed to load orders: ${res.statusText}`)
      const data: unknown = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load orders'
      toast.error(message)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  async function handleSaveOrder(orderId: string, form: OrderEditForm) {
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to update order')
      toast.success(lang === 'ru' ? 'Заказ обновлён' : lang === 'en' ? 'Order updated' : 'ההזמנה עודכנה')
      await loadOrders()
      setEditingOrder(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update order'
      toast.error(message)
    }
  }

  async function handleUpdateItemPrice(orderId: string, itemId: string, pricePerPiece: number, color: string) {
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_per_piece: pricePerPiece, color }),
      })
      if (!res.ok) throw new Error('Failed to update item price')

      const freshRes = await authFetch('/api/admin/orders')
      if (freshRes.ok) {
        const freshOrders: Order[] = await freshRes.json()
        setOrders(Array.isArray(freshOrders) ? freshOrders : [])
        if (editingOrder?.id === orderId) {
          const freshOrder = freshOrders.find((o) => o.id === orderId)
          if (freshOrder) setEditingOrder(freshOrder)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update item'
      toast.error(message)
    }
  }

  async function handleGeneratePdf(order: Order) {
    try {
      const res = await authFetch(`/api/admin/orders/${order.id}/pdf`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(data.error ?? 'Failed to generate PDF')
      }
      const data = await res.json() as { pdfUrl?: string }
      if (data.pdfUrl) {
        window.open(data.pdfUrl, '_blank')
      } else {
        toast.info(lang === 'ru' ? 'PDF создан' : lang === 'en' ? 'PDF generated' : 'PDF נוצר')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error generating PDF'
      toast.error(message)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
        <div className="container py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white/60">Loading orders...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="container py-8">
        <h1 className="text-4xl font-bold mb-8">
          {lang === 'ru' ? 'Заказы профилей' : lang === 'en' ? 'Profile Orders' : 'הזמנות פרופילים'}
        </h1>

        {orders.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 text-center text-white/60">
            {lang === 'ru' ? 'Нет заказов' : lang === 'en' ? 'No orders' : 'אין הזמנות'}
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onEdit={setEditingOrder}
                getStatusColor={getStatusColor}
                getStatusLabel={getStatusLabel}
              />
            ))}
          </div>
        )}

        {editingOrder !== null && (
          <OrderEditModal
            order={editingOrder}
            language={lang}
            getStatusLabel={getStatusLabel}
            onClose={() => setEditingOrder(null)}
            onSave={handleSaveOrder}
            onUpdateItemPrice={handleUpdateItemPrice}
            onGeneratePdf={handleGeneratePdf}
          />
        )}
      </div>
    </main>
  )
}
