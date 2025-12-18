export interface Deal {
  id: string
  lead_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  customer_city?: string | null
  project_type?: 'pergola' | 'railing' | 'gates' | 'windows' | 'laundry_closet' | null
  width?: number | null
  depth?: number | null
  shape?: 'прямоугольник' | 'Г-образная' | 'ר' | 'ח' | 'מקיר לקיר' | null
  laundry_model?: string | null // דגם מסתור
  laundry_distance?: number | null // מרחק
  laundry_lighting?: boolean | null // אור
  material?: string | null
  color_ral?: string | null
  price?: number | null
  my_cost?: number | null
  order_date?: string | null
  material_order_date?: string | null
  material_received_date?: string | null
  installation_date?: string | null
  lighting?: string | null
  shading_ratio?: '40/20' | '50/20' | '70/20' | null
  finish_type?: 'ral' | 'wood' | null
  finish_value?: string | null
  stage?: 'new' | 'measure' | 'offer' | 'offer_approved' | 'material_ordered' | 'approved' | 'production' | 'install' | 'done' | null
  notes?: string | null
  files?: any
  manager?: string | null
  sketch_image_url?: string | null
  sketch_json?: any
  created_at?: string | null
  updated_at?: string | null
}

// Base stages with colors (labels will be translated)
export const STAGES_BASE = [
  { id: 'new', color: 'bg-gray-500' },
  { id: 'measure', color: 'bg-purple-500' },
  { id: 'offer', color: 'bg-yellow-500' },
  { id: 'offer_approved', color: 'bg-yellow-600' },
  { id: 'material_ordered', color: 'bg-blue-500' },
  { id: 'approved', color: 'bg-green-500' },
  { id: 'production', color: 'bg-orange-500' },
  { id: 'install', color: 'bg-indigo-500' },
  { id: 'done', color: 'bg-emerald-600' },
] as const

// Helper function to get stages with translated labels
export function getStages(translations: { stages: Record<string, string> }) {
  return STAGES_BASE.map(stage => ({
    ...stage,
    label: translations.stages[stage.id] || stage.id,
  }))
}

// Legacy export for backward compatibility (will use default Russian)
export const STAGES = [
  { id: 'new', label: 'Новая', color: 'bg-gray-500' },
  { id: 'measure', label: 'Замер', color: 'bg-purple-500' },
  { id: 'offer', label: 'הצעת מחיר', color: 'bg-yellow-500' },
  { id: 'offer_approved', label: 'הצעת מחיר מאושרת', color: 'bg-yellow-600' },
  { id: 'material_ordered', label: 'חומר הוזמן', color: 'bg-blue-500' },
  { id: 'approved', label: 'חומר שהגיע למפעל', color: 'bg-green-500' },
  { id: 'production', label: 'Производство', color: 'bg-orange-500' },
  { id: 'install', label: 'Установка', color: 'bg-indigo-500' },
  { id: 'done', label: 'Готово', color: 'bg-emerald-600' },
] as const

