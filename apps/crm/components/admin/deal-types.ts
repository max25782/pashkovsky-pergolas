export type WorkType = 'pergola' | 'railings' | 'gates' | 'facade' | 'fence' | 'other'

export type FenceVariant = 'classic' | 'hitech' | 'hitech_angular'

export type RailingsGlazingSystem = 'aluminum_glass' | 'wet_glazing' | 'dry_glazing'
export type CustomerType = 'private' | 'contractor'
export type PricingModel = 'fixed' | 'per_meter' | 'per_sqm' | 'custom'

export interface ContractorPaymentProfile {
  preset?: '10_20_30_30_10' | 'custom'
  stages?: Array<{ percent: number; label?: string; expected_amount?: number }>
  notes?: string
}

export interface DealRailingsDetails {
  deal_id: string
  company_id: string
  meters_total: number
  height_cm?: number | null
  profile_type: string
  color: string
  location_type: 'balcony' | 'stairs' | 'roof' | 'yard' | 'other'
  glass_type?: string | null
  glazing_system?: RailingsGlazingSystem | null
  railing_type?: string | null
  material?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface DealFenceDetails {
  deal_id: string
  company_id: string
  meters_total: number
  height_cm?: number | null
  fence_variant: FenceVariant
  color: string
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface Deal {
  id: string
  work_type?: WorkType | null
  customer_type?: CustomerType | null
  pricing_model?: PricingModel | null
  contractor_payment_profile?: ContractorPaymentProfile | null
  lead_id?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  customer_email?: string | null
  customer_city?: string | null
  project_type?: 'pergola' | 'railing' | 'gates' | 'windows' | 'laundry_closet' | 'fence' | null
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
  deal_railings_details?: DealRailingsDetails | null
  deal_fence_details?: DealFenceDetails | null
  created_at?: string | null
  updated_at?: string | null
  /** Deal origin, e.g. quick_offer vs quick_offer_saved (CRM board visibility). */
  source?: string | null
  // Railings fields (for PATCH payload when work_type is railings)
  meters_total?: number | null
  height_cm?: number | null
  profile_type?: string | null
  color?: string | null
  location_type?: DealRailingsDetails['location_type'] | null
  glass_type?: string | null
  glazing_system?: RailingsGlazingSystem | null
  railings_notes?: string | null
  /** PATCH/create payload when work_type is fence */
  fence_meters_total?: number | null
  fence_height_cm?: number | null
  fence_variant?: FenceVariant | null
  fence_color?: string | null
  fence_notes?: string | null
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

