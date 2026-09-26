export type FollowUpTiming = 'none' | 'today' | 'upcoming' | 'overdue'

function startOfLocalDay(date: Date): number {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

export function followUpTiming(iso: string | null | undefined, now = new Date()): FollowUpTiming {
  if (!iso) return 'none'
  const target = new Date(iso)
  if (Number.isNaN(target.getTime())) return 'none'
  const diff = startOfLocalDay(target) - startOfLocalDay(now)
  if (diff === 0) return 'today'
  if (diff < 0) return 'overdue'
  return 'upcoming'
}

export function isFollowUpDue(iso: string | null | undefined, now = new Date()): boolean {
  const timing = followUpTiming(iso, now)
  return timing === 'today' || timing === 'overdue'
}

/** Local midnight, `days` from today, as an ISO timestamp. */
export function followUpInDays(days: number, now = new Date()): string {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function followUpFromDateInput(value: string): string | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

export function followUpToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function formatFollowUpDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${day}.${month}.${date.getFullYear()}`
}
