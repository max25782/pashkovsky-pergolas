export interface Deal {
  id: string
  lead_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  customer_city?: string | null
  project_type?: 'pergola' | 'railing' | 'gates' | 'windows' | null
  width?: number | null
  depth?: number | null
  shape?: 'прямоугольник' | 'Г-образная' | null
  material?: string | null
  color_ral?: string | null
  price?: number | null
  my_cost?: number | null
  order_date?: string | null
  material_order_date?: string | null
  material_received_date?: string | null
  installation_date?: string | null
  lighting?: string | null
  stage?: 'new' | 'measure' | 'offer' | 'approved' | 'production' | 'install' | 'done' | null
  notes?: string | null
  files?: any
  manager?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const STAGES = [
  { id: 'new', label: 'Новая', color: 'bg-gray-500' },
  { id: 'measure', label: 'Замер', color: 'bg-purple-500' },
  { id: 'offer', label: 'Предложение', color: 'bg-yellow-500' },
  { id: 'approved', label: 'Утверждено', color: 'bg-green-500' },
  { id: 'production', label: 'Производство', color: 'bg-orange-500' },
  { id: 'install', label: 'Установка', color: 'bg-indigo-500' },
  { id: 'done', label: 'Готово', color: 'bg-emerald-600' },
] as const

