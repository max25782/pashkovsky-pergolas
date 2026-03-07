export type OrderStatus =
  | 'pending_price'
  | 'priced'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface OrderItem {
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

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_city: string
  status: OrderStatus
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
  payment_status?: PaymentStatus
}

export interface OrderEditForm {
  status: OrderStatus
  final_amount: number
  discount_percent: number
  discount_amount: number
  notes: string
  customer_notes: string
  delivery_date: string
  payment_status: PaymentStatus
}
