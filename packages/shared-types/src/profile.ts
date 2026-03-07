export interface AluminumProfileFull {
  id: string
  code: string
  name_he: string
  name_ru?: string
  name_en?: string
  dimensions: string
  image_url?: string
  weight_per_meter: number
  price_per_kg: number
  available_lengths: number[]
  category?: string
  sku?: string
  stock?: Record<string, { available: number; color: string }>
}

export interface StockInfo {
  color: string
  length_meters: number
  qty_available: number
  qty_reserved: number
}
