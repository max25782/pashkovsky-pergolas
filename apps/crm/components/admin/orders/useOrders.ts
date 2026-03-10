'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'
import type { Order, OrderEditForm } from './order-types'
import type { Language } from './order-constants'

interface UseOrdersResult {
  orders: Order[]
  loading: boolean
  editingOrder: Order | null
  setEditingOrder: (order: Order | null) => void
  loadOrders: () => Promise<Order[]>
  handleSaveOrder: (orderId: string, form: OrderEditForm) => Promise<void>
  handleUpdateItemPrice: (orderId: string, itemId: string, pricePerPiece: number, color: string) => Promise<void>
  handleDeleteOrder: (order: Order) => Promise<void>
  handleGeneratePdf: (order: Order) => Promise<void>
}

export function useOrders(lang: Language): UseOrdersResult {
  const toast = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  const loadOrders = useCallback(async (): Promise<Order[]> => {
    try {
      setLoading(true)
      const res = await authFetch('/api/admin/orders')
      if (!res.ok) throw new Error(`Failed to load orders: ${res.statusText}`)
      const data: unknown = await res.json()
      const fresh = Array.isArray(data) ? (data as Order[]) : []
      setOrders(fresh)
      return fresh
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load orders')
      setOrders([])
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadOrders() }, [loadOrders])

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
      toast.error(error instanceof Error ? error.message : 'Failed to update order')
    }
  }

  async function handleUpdateItemPrice(
    orderId: string,
    itemId: string,
    pricePerPiece: number,
    color: string,
  ) {
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_per_piece: pricePerPiece, color }),
      })
      if (!res.ok) throw new Error('Failed to update item price')
      const fresh = await loadOrders()
      // Sync the open modal with the refreshed order list
      setEditingOrder((prev) => {
        if (prev?.id !== orderId) return prev
        return fresh.find((o) => o.id === orderId) ?? prev
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update item')
    }
  }

  async function handleDeleteOrder(order: Order) {
    const confirmMsg =
      lang === 'ru'
        ? `Удалить заказ ${order.order_number}?`
        : lang === 'en'
          ? `Delete order ${order.order_number}?`
          : `למחוק הזמנה ${order.order_number}?`
    if (!confirm(confirmMsg)) return
    try {
      const res = await authFetch(`/api/admin/orders/${order.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete order')
      toast.success(lang === 'ru' ? 'Заказ удалён' : lang === 'en' ? 'Order deleted' : 'ההזמנה נמחקה')
      await loadOrders()
      if (editingOrder?.id === order.id) setEditingOrder(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete order')
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
      toast.error(error instanceof Error ? error.message : 'Error generating PDF')
    }
  }

  return {
    orders,
    loading,
    editingOrder,
    setEditingOrder,
    loadOrders,
    handleSaveOrder,
    handleUpdateItemPrice,
    handleDeleteOrder,
    handleGeneratePdf,
  }
}
