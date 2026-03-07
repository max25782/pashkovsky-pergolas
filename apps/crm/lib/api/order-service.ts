import { authFetch } from '@/lib/api/auth-fetch'

export interface OrderItemProfile {
  id: string
  code: string
  name_he: string
  name_ru?: string
  name_en?: string
  image_url?: string
}

export interface OrderItem {
  id: string
  profile_id: string
  color: string
  length_meters: number
  quantity_pieces: number
  weight_per_piece: number
  total_weight_kg: number
  price_per_kg?: number
  price_per_piece: number
  subtotal: number
  aluminum_profiles?: OrderItemProfile
}

export interface Order {
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

export interface UpdateOrderPayload {
  status?: string
  final_amount?: number
  discount_percent?: number
  discount_amount?: number
  notes?: string
  customer_notes?: string
  delivery_date?: string
  payment_status?: string
}

export interface UpdateOrderItemPayload {
  price_per_piece: number
  color?: string
}

export class OrderService {
  async fetchOrders(): Promise<Order[]> {
    const res = await authFetch('/api/admin/orders')
    if (!res.ok) throw new Error(`Failed to load orders: ${res.statusText}`)
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  async updateOrder(orderId: string, payload: UpdateOrderPayload): Promise<Order> {
    const res = await authFetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { message?: string }).message ?? 'Failed to update order')
    }
    return res.json()
  }

  async updateOrderItem(
    orderId: string,
    itemId: string,
    payload: UpdateOrderItemPayload,
  ): Promise<OrderItem> {
    const res = await authFetch(`/api/admin/orders/${orderId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { message?: string }).message ?? 'Failed to update item')
    }
    return res.json()
  }

  async generatePdf(orderId: string): Promise<Blob> {
    const res = await authFetch(`/api/admin/orders/${orderId}/pdf`)
    if (!res.ok) throw new Error('Failed to generate PDF')
    return res.blob()
  }
}

export const orderService = new OrderService()
