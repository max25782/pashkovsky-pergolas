export interface Lead {
  id: string
  name: string
  phone: string
  city?: string | null
  email?: string | null
  source?: string | null
  status?: 'pending' | 'confirmed' | 'contacted' | 'qualified' | 'won' | 'lost' | null
  notes?: string | null
  last_message?: string | null
  last_message_at?: string | null
  created_at?: string | null
  score?: number | null
  score_updated_at?: string | null
  score_breakdown_json?: {
    ruleScore?: number
    aiDelta?: number
    reasons?: string[]
    aiReasons?: string[]
    suggestedNextAction?: string
  } | null
}

export const LEAD_STATUSES = [
  { id: 'pending', label: 'Ожидает', color: 'bg-gray-500' },
  { id: 'confirmed', label: 'Подтвержден', color: 'bg-blue-500' },
  { id: 'contacted', label: 'Связались', color: 'bg-purple-500' },
  { id: 'qualified', label: 'Квалифицирован', color: 'bg-yellow-500' },
  { id: 'won', label: 'Выигран', color: 'bg-green-500' },
  { id: 'lost', label: 'Проигран', color: 'bg-red-500' },
] as const

