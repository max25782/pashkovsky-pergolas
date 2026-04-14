export interface Lead {
  id: string
  name: string
  phone: string
  city?: string | null
  email?: string | null
  source?: string | null
  status?: 'waiting' | 'busy' | 'no_answer' | 'thinking' | 'meeting_set' | 'visited' | 'not_relevant' | 'not_interested' | 'lost_contact' | null
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
  { id: 'waiting',       label: 'Ожидает',            labelHe: 'ממתין',           color: 'bg-gray-500' },
  { id: 'busy',          label: 'Занято',              labelHe: 'תפוס',            color: 'bg-orange-400' },
  { id: 'no_answer',     label: 'Не отвечает',         labelHe: 'לא עונה',         color: 'bg-yellow-500' },
  { id: 'thinking',      label: 'Думает/Перезвонить',  labelHe: 'חושב/יחזור',      color: 'bg-blue-400' },
  { id: 'meeting_set',   label: 'Назначена встреча',   labelHe: 'נקבעה פגישה',     color: 'bg-purple-500' },
  { id: 'visited',       label: 'Выполнен визит',      labelHe: 'בוצע ביקור',      color: 'bg-indigo-500' },
  { id: 'not_relevant',  label: 'Не актуально',        labelHe: 'לא רלוונטי',      color: 'bg-red-400' },
  { id: 'not_interested',label: 'Не заинтересован',    labelHe: 'לא מעוניין',      color: 'bg-red-600' },
  { id: 'lost_contact',  label: 'Потерян контакт',     labelHe: 'אובד קשר',        color: 'bg-gray-600' },
] as const

export const LEAD_SOURCES = [
  { id: 'facebook', label: 'Facebook', color: 'bg-blue-600' },
  { id: 'website', label: 'Сайт', color: 'bg-emerald-600' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-black' },
  { id: 'other', label: 'Другое', color: 'bg-gray-600' },
] as const

export function normalizeLeadSource(source: string | null | undefined): string {
  if (!source?.trim()) return 'other'
  const s = source.trim().toLowerCase()
  if (s === 'facebook' || s === 'fb') return 'facebook'
  if (s === 'website' || s === 'site' || s === 'сайт') return 'website'
  if (s === 'tiktok' || s === 'tik-tok') return 'tiktok'
  return 'other'
}

