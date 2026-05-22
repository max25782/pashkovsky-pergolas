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
  { id: 'waiting',        label: 'Ожидает',           labelHe: 'ממתין',         labelEn: 'Waiting',            labelSr: 'Na čekanju',       color: 'bg-gray-500' },
  { id: 'busy',           label: 'Занято',             labelHe: 'תפוס',          labelEn: 'Busy',               labelSr: 'Zauzeto',          color: 'bg-orange-400' },
  { id: 'no_answer',      label: 'Не отвечает',        labelHe: 'לא עונה',       labelEn: 'No Answer',          labelSr: 'Ne odgovara',      color: 'bg-yellow-500' },
  { id: 'thinking',       label: 'Думает/Перезвонить', labelHe: 'חושב/יחזור',    labelEn: 'Thinking/Call Back', labelSr: 'Razmišlja/Povratni poziv', color: 'bg-blue-400' },
  { id: 'meeting_set',    label: 'Назначена встреча',  labelHe: 'נקבעה פגישה',   labelEn: 'Meeting Set',        labelSr: 'Sastanak zakazan', color: 'bg-purple-500' },
  { id: 'visited',        label: 'Выполнен визит',     labelHe: 'בוצע ביקור',    labelEn: 'Visit Done',         labelSr: 'Poseta obavljena', color: 'bg-indigo-500' },
  { id: 'not_relevant',   label: 'Не актуально',       labelHe: 'לא רלוונטי',    labelEn: 'Not Relevant',       labelSr: 'Nije relevantno',  color: 'bg-red-400' },
  { id: 'not_interested', label: 'Не заинтересован',   labelHe: 'לא מעוניין',    labelEn: 'Not Interested',     labelSr: 'Nije zainteresovan', color: 'bg-red-600' },
  { id: 'lost_contact',   label: 'Потерян контакт',    labelHe: 'אובד קשר',      labelEn: 'Lost Contact',       labelSr: 'Izgubljen kontakt', color: 'bg-gray-600' },
] as const

export const LEAD_SOURCES = [
  { id: 'facebook', label: 'Facebook', labelHe: 'Facebook',  labelEn: 'Facebook', labelSr: 'Facebook', color: 'bg-blue-600' },
  { id: 'website',  label: 'Сайт',     labelHe: 'אתר',       labelEn: 'Website',  labelSr: 'Sajt',     color: 'bg-emerald-600' },
  { id: 'tiktok',   label: 'TikTok',   labelHe: 'TikTok',    labelEn: 'TikTok',   labelSr: 'TikTok',   color: 'bg-black' },
  { id: 'other',    label: 'Другое',   labelHe: 'אחר',       labelEn: 'Other',    labelSr: 'Ostalo',   color: 'bg-gray-600' },
] as const

type Language = 'he' | 'ru' | 'en' | 'sr'

export function pickLabel(
  entry: { label: string; labelHe: string; labelEn: string; labelSr?: string },
  language: Language,
): string {
  if (language === 'he') return entry.labelHe
  if (language === 'en') return entry.labelEn
  if (language === 'sr') return entry.labelSr ?? entry.labelEn
  return entry.label
}

export function getLeadStatusLabel(id: string | null | undefined, language: Language): string {
  const found = LEAD_STATUSES.find(s => s.id === id)
  return found ? pickLabel(found, language) : (id ?? '')
}

export function getLeadSourceLabel(id: string | null | undefined, language: Language): string {
  const found = LEAD_SOURCES.find(s => s.id === id)
  return found ? pickLabel(found, language) : (id ?? '')
}

export function normalizeLeadSource(source: string | null | undefined): string {
  if (!source?.trim()) return 'other'
  const s = source.trim().toLowerCase()
  if (s === 'facebook' || s === 'fb') return 'facebook'
  if (s === 'website' || s === 'site' || s === 'сайт') return 'website'
  if (s === 'tiktok' || s === 'tik-tok') return 'tiktok'
  return 'other'
}

