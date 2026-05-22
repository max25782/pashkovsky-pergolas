import type { OrderStatus } from './order-types'

export type Language = 'ru' | 'en' | 'he' | 'sr'

export interface StatusConfig {
  color: string
  labels: Record<Language, string>
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  pending_price: {
    color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
    labels: { ru: 'Ожидает цены', en: 'Pending Price', he: 'ממתין למחיר', sr: 'Na čekanju cene' },
  },
  priced: {
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
    labels: { ru: 'Цена установлена', en: 'Priced', he: 'מחיר הוגדר', sr: 'Procenjen' },
  },
  confirmed: {
    color: 'bg-green-500/20 text-green-300 border-green-500/50',
    labels: { ru: 'Подтвержден', en: 'Confirmed', he: 'אושר', sr: 'Potvrđen' },
  },
  preparing: {
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/50',
    labels: { ru: 'Готовится', en: 'Preparing', he: 'בהכנה', sr: 'U pripremi' },
  },
  ready: {
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50',
    labels: { ru: 'Готов', en: 'Ready', he: 'מוכן', sr: 'Spreman' },
  },
  delivered: {
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
    labels: { ru: 'Доставлен', en: 'Delivered', he: 'נמסר', sr: 'Isporučen' },
  },
  cancelled: {
    color: 'bg-red-500/20 text-red-300 border-red-500/50',
    labels: { ru: 'Отменен', en: 'Cancelled', he: 'בוטל', sr: 'Otkazan' },
  },
}

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_CONFIG) as OrderStatus[]

export function getStatusColor(status: string): string {
  return ORDER_STATUS_CONFIG[status as OrderStatus]?.color
    ?? 'bg-gray-500/20 text-gray-300 border-gray-500/50'
}

export function getStatusLabel(status: string, lang: Language): string {
  return ORDER_STATUS_CONFIG[status as OrderStatus]?.labels[lang] ?? status
}
