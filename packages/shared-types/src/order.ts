export type OrderStatus =
  | 'pending_price'
  | 'priced'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface AluminumProfile {
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
  price_per_kg: number
  price_per_piece: number
  subtotal: number
  aluminum_profiles?: AluminumProfile
}

export interface Order {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_city: string
  delivery_address: string
  status: OrderStatus
  payment_status?: PaymentStatus
  total_weight_kg: number
  total_amount: number
  final_amount: number
  source: string
  notes?: string
  customer_notes?: string
  delivery_date?: string
  created_at: string
  order_items: OrderItem[]
}

export interface OrderCustomer {
  name: string
  phone: string
  email: string
  city: string
  address: string
}

export interface CreateOrderItemPayload {
  profile_id: string
  color: string
  length_meters: number
  quantity_pieces: number
  price_per_piece: number
}

export interface CreateOrderPayload {
  customer: OrderCustomer
  items: CreateOrderItemPayload[]
}
