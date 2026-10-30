/**
 * Pure deal-revenue helpers. No React, no Supabase.
 * Shared by CRM statistics, monthly report API, and analytics.
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

export interface RevenueDeal {
  id?: string | null
  stage?: string | null
  customer_type?: string | null
  customer_name?: string | null
  price?: number | string | null
  my_cost?: number | string | null
  installation_date?: string | null
  order_date?: string | null
  created_at?: string | null
}

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

export interface MonthDealRow<T extends RevenueDeal = RevenueDeal> {
  deal: T
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

export interface MoneyMonthProject {
  projectId: string
  projectName: string
  customerName: string
  revenue: number
  laborCost: number
  profit: number
}

export interface MoneyMonthReport {
  month: string
  totalRevenue: number
  totalLaborCost: number
  totalProfit: number
  projects: MoneyMonthProject[]
}

function numericAmount(value: number | string | null | undefined): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function isRevenueStage(stage: string | null | undefined): stage is RevenueStage {
  return stage != null && (REVENUE_STAGES as readonly string[]).includes(stage)
}

export function isRevenueDeal(deal: RevenueDeal | null | undefined, mode: StatisticType): boolean {
  if (!deal?.id) return false
  if (mode === 'money') {
    if (deal.customer_type === 'contractor') return true
    return deal.stage === 'done' && deal.installation_date != null
  }
  return isRevenueStage(deal.stage)
}

export function getDealAttributionDate(
  deal: RevenueDeal,
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
  deal: RevenueDeal,
  month: string,
  paymentsByDeal: Map<string, Array<{ amount: number; paid_at: string }>>,
): { hasPayments: boolean; revenue: number } {
  const dealPayments = paymentsByDeal.get(deal.id ?? '') ?? []
  let hasPayments = false
  const revenue = dealPayments.reduce((sum, payment) => {
    if (monthKeyFromIso(payment.paid_at) !== month) return sum
    hasPayments = true
    return sum + payment.amount
  }, 0)
  return { hasPayments, revenue }
}

export function getMonthDealRows<T extends RevenueDeal>(
  deals: T[],
  month: string,
  mode: StatisticType,
  paymentsByDeal: Map<string, Array<{ amount: number; paid_at: string }>>,
): { rows: MonthDealRow<T>[]; totals: MonthDealTotals } {
  const rows: MonthDealRow<T>[] = []
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

    const revenue = numericAmount(deal.price)
    const expenses = numericAmount(deal.my_cost)
    rows.push({ deal, revenue, expenses, profit: revenue - expenses })
    addTotals(totals, revenue, expenses, 1)
  })

  return { rows, totals }
}

export function aggregateMonthlyDealStats<T extends RevenueDeal>(
  deals: T[],
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
      const dealPayments = paymentsByDeal.get(deal.id ?? '') ?? []
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

    addToMonth(monthKeyFromIso(dateToUse) as string, numericAmount(deal.price), numericAmount(deal.my_cost), 1)
  })

  const monthlyStats = Array.from(statsMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .reverse()

  return { monthlyStats, datelessCount }
}

/** Pipeline value/cost for mode `all` or cash deals for mode `money` (deal.price / my_cost). */
export function sumRevenueDealTotals(
  deals: RevenueDeal[],
  mode: StatisticType,
): { revenue: number; expenses: number } {
  return deals.reduce(
    (acc, deal) => {
      if (!isRevenueDeal(deal, mode)) return acc
      acc.revenue += numericAmount(deal.price)
      acc.expenses += numericAmount(deal.my_cost)
      return acc
    },
    { revenue: 0, expenses: 0 },
  )
}

export function buildMoneyMonthReport<T extends RevenueDeal>(
  deals: T[],
  month: string,
  paymentsByDeal: Map<string, Array<{ amount: number; paid_at: string }>>,
): MoneyMonthReport {
  const { rows, totals } = getMonthDealRows(deals, month, 'money', paymentsByDeal)
  return {
    month,
    totalRevenue: totals.revenue,
    totalLaborCost: totals.expenses,
    totalProfit: totals.profit,
    projects: rows
      .map((row) => ({
        projectId: String(row.deal.id),
        projectName: `Deal ${String(row.deal.id).slice(0, 8)}`,
        customerName: row.deal.customer_name || 'Without name',
        revenue: row.revenue,
        laborCost: row.expenses,
        profit: row.profit,
      }))
      .sort((a, b) => b.revenue - a.revenue),
  }
}

function isoInRange(iso: string | null | undefined, fromIso: string, toIso: string): boolean {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= new Date(fromIso).getTime() && t <= new Date(toIso).getTime()
}

/** Money-mode totals for an ISO date range (same rules as the month table). */
export function sumMoneyInDateRange(
  deals: RevenueDeal[],
  paymentsByDeal: Map<string, Array<{ amount: number; paid_at: string }>>,
  fromIso: string,
  toIso: string,
): MonthDealTotals {
  const totals = emptyTotals()

  deals.forEach((deal) => {
    if (!isRevenueDeal(deal, 'money')) return

    if (deal.customer_type === 'contractor') {
      const dealPayments = paymentsByDeal.get(deal.id ?? '') ?? []
      let revenue = 0
      let hasPayments = false
      dealPayments.forEach((payment) => {
        if (!isoInRange(payment.paid_at, fromIso, toIso)) return
        hasPayments = true
        revenue += payment.amount
      })
      if (!hasPayments) return
      addTotals(totals, revenue, 0, 1)
      return
    }

    if (!isoInRange(deal.installation_date, fromIso, toIso)) return
    addTotals(totals, numericAmount(deal.price), numericAmount(deal.my_cost), 1)
  })

  return totals
}
