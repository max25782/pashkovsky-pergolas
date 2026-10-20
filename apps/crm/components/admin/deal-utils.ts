import type { Deal } from './deal-types'

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  return dateStr.slice(0, 16).replace('T', ' ')
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-'
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount)
}

export function formatDimensions(width: number | null | undefined, depth: number | null | undefined): string {
  if (width && depth) return `${width}×${depth} см`
  if (width) return `${width}×? см`
  if (depth) return `?×${depth} см`
  return '-'
}

/**
 * Stages that count as revenue in statistic mode `all`.
 * Starts at signed offer (הצעת מחיר מאושרת) and includes material-at-factory (`approved`).
 */
export const REVENUE_STAGES = [
  'offer_approved',
  'material_ordered',
  'approved',
  'production',
  'install',
  'done',
] as const
export type RevenueStage = (typeof REVENUE_STAGES)[number]

/** Funnel order from getStages. new / measure / offer are not revenue. */
export const FUNNEL_STAGES = [
  'new',
  'measure',
  'offer',
  'offer_approved',
  'material_ordered',
  'approved',
  'production',
  'install',
  'done',
] as const

export type StatisticType = 'all' | 'money'

export interface DealPayment {
  deal_id: string
  amount: number
  paid_at: string
}

export interface MonthlyDealStats {
  month: string
  monthLabel: string
  revenue: number
  expenses: number
  profit: number
  dealCount: number
}

export interface MonthDealRow {
  deal: Deal
  revenue: number
  expenses: number
  profit: number
}

export interface MonthDealTotals {
  revenue: number
  expenses: number
  profit: number
  dealCount: number
}

function isRevenueStage(stage: Deal['stage']): stage is RevenueStage {
  return stage != null && (REVENUE_STAGES as readonly string[]).includes(stage)
}

export function isRevenueDeal(deal: Deal | null | undefined, mode: StatisticType): boolean {
  if (!deal?.id) return false
  if (mode === 'money') {
    if (deal.customer_type === 'contractor') return true
    return deal.stage === 'done' && deal.installation_date != null
  }
  return isRevenueStage(deal.stage)
}

export function getDealAttributionDate(
  deal: Deal,
  mode: StatisticType,
): string | null | undefined {
  if (mode === 'money') return deal.installation_date
  return deal.installation_date || deal.order_date || deal.created_at
}

export function monthKeyFromIso(dateStr: string): string | null {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return null
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

export function buildPaymentsByDeal(
  payments: DealPayment[],
): Map<string, Array<{ amount: number; paid_at: string }>> {
  const map = new Map<string, Array<{ amount: number; paid_at: string }>>()
  payments.forEach((payment) => {
    const list = map.get(payment.deal_id) ?? []
    list.push({ amount: Number(payment.amount), paid_at: payment.paid_at })
    map.set(payment.deal_id, list)
  })
  return map
}

function emptyTotals(): MonthDealTotals {
  return { revenue: 0, expenses: 0, profit: 0, dealCount: 0 }
}

function addTotals(target: MonthDealTotals, revenue: number, expenses: number, dealCount: number) {
  target.revenue += revenue
  target.expenses += expenses
  target.profit = target.revenue - target.expenses
  target.dealCount += dealCount
}

function contractorMonthRevenue(
  deal: Deal,
  month: string,
  paymentsByDeal: Map<string, Array<{ amount: number; paid_at: string }>>,
): { hasPayments: boolean; revenue: number } {
  const dealPayments = paymentsByDeal.get(deal.id) ?? []
  let hasPayments = false
  const revenue = dealPayments.reduce((sum, payment) => {
    if (monthKeyFromIso(payment.paid_at) !== month) return sum
    hasPayments = true
    return sum + payment.amount
  }, 0)
  return { hasPayments, revenue }
}

export function getMonthDealRows(
  deals: Deal[],
  month: string,
  mode: StatisticType,
  paymentsByDeal: Map<string, Array<{ amount: number; paid_at: string }>>,
): { rows: MonthDealRow[]; totals: MonthDealTotals } {
  const rows: MonthDealRow[] = []
  const totals = emptyTotals()

  deals.forEach((deal) => {
    if (!isRevenueDeal(deal, mode)) return

    if (mode === 'money' && deal.customer_type === 'contractor') {
      const { hasPayments, revenue } = contractorMonthRevenue(deal, month, paymentsByDeal)
      if (!hasPayments) return
      const expenses = 0
      rows.push({ deal, revenue, expenses, profit: revenue - expenses })
      addTotals(totals, revenue, expenses, 1)
      return
    }

    const dateToUse = getDealAttributionDate(deal, mode)
    if (!dateToUse) return
    if (monthKeyFromIso(dateToUse) !== month) return

    const revenue = deal.price || 0
    const expenses = deal.my_cost || 0
    rows.push({ deal, revenue, expenses, profit: revenue - expenses })
    addTotals(totals, revenue, expenses, 1)
  })

  return { rows, totals }
}

export function aggregateMonthlyDealStats(
  deals: Deal[],
  mode: StatisticType,
  paymentsByDeal: Map<string, Array<{ amount: number; paid_at: string }>>,
  dateLocale: string,
): { monthlyStats: MonthlyDealStats[]; datelessCount: number } {
  const statsMap = new Map<string, MonthlyDealStats>()
  let datelessCount = 0

  const addToMonth = (monthKey: string, revenue: number, expenses: number, dealCount: number) => {
    const [year, month] = monthKey.split('-').map(Number)
    const localDate = new Date(year, month - 1, 1)
    const monthLabel = localDate.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long' })
    const existing = statsMap.get(monthKey) || {
      month: monthKey,
      monthLabel,
      revenue: 0,
      expenses: 0,
      profit: 0,
      dealCount: 0,
    }
    addTotals(existing, revenue, expenses, dealCount)
    statsMap.set(monthKey, existing)
  }

  deals.forEach((deal) => {
    if (!isRevenueDeal(deal, mode)) return

    if (mode === 'money' && deal.customer_type === 'contractor') {
      const dealPayments = paymentsByDeal.get(deal.id) ?? []
      const dealMonths = new Set<string>()
      dealPayments.forEach((payment) => {
        const monthKey = monthKeyFromIso(payment.paid_at)
        if (!monthKey) return
        addToMonth(monthKey, payment.amount, 0, 0)
        dealMonths.add(monthKey)
      })
      dealMonths.forEach((monthKey) => addToMonth(monthKey, 0, 0, 1))
      return
    }

    const dateToUse = getDealAttributionDate(deal, mode)
    if (!dateToUse || !monthKeyFromIso(dateToUse)) {
      if (mode === 'all') datelessCount += 1
      return
    }

    addToMonth(monthKeyFromIso(dateToUse) as string, deal.price || 0, deal.my_cost || 0, 1)
  })

  const monthlyStats = Array.from(statsMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .reverse()

  return { monthlyStats, datelessCount }
}

