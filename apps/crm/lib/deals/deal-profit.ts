/**
 * VAT payable and net profit of deals for the CRM views: the kanban card, the
 * monthly statistics table and the profit ranking. Built on deal-finance.ts
 * and on the same attribution rules as revenue.ts (which month a deal
 * belongs to), so the new columns line up with the existing ones.
 *
 * Pure: no React, no Supabase.
 */

import { roundMoney } from '@/lib/finance/money'
import {
  allocateByPayments,
  computeDealFinance,
  type DealFinance,
} from '@/lib/deals/deal-finance'
import {
  getDealAttributionDate,
  isRevenueDeal,
  monthKeyFromIso,
  type RevenueDeal,
  type StatisticType,
} from '@/lib/deals/revenue'

export interface DealFinanceContext {
  vatPercent: number
  /** Worker cost per deal id (employer cost, no VAT). Missing = no shifts = 0. */
  laborByDeal: Record<string, number>
}

type PaymentsByDeal = Map<string, Array<{ amount: number; paid_at: string }>>

export function dealFinanceFor(deal: RevenueDeal, context: DealFinanceContext): DealFinance {
  return computeDealFinance({
    price: deal.price,
    materials: deal.my_cost,
    labor: deal.id ? (context.laborByDeal[deal.id] ?? 0) : 0,
    vatPercent: context.vatPercent,
  })
}

export interface NetMetrics {
  vatPayable: number
  netProfit: number
}

export const EMPTY_NET_METRICS: NetMetrics = { vatPayable: 0, netProfit: 0 }

function addMetrics(a: NetMetrics, b: NetMetrics): NetMetrics {
  return {
    vatPayable: roundMoney(a.vatPayable + b.vatPayable),
    netProfit: roundMoney(a.netProfit + b.netProfit),
  }
}

/**
 * The deal's metrics that fall in `month`, or null when none do. A contractor
 * deal in money mode is paid in stages: each month carries the share of the
 * deal's VAT and net profit that matches the money received that month. Every
 * other deal belongs entirely to its attribution month, as in revenue.ts.
 */
function dealNetMetricsByMonth(
  deal: RevenueDeal,
  mode: StatisticType,
  paymentsByDeal: PaymentsByDeal,
  context: DealFinanceContext,
): Map<string, NetMetrics> {
  const byMonth = new Map<string, NetMetrics>()
  const finance = dealFinanceFor(deal, context)

  if (mode === 'money' && deal.customer_type === 'contractor') {
    const payments = (paymentsByDeal.get(deal.id ?? '') ?? []).map((p, index) => ({
      id: String(index),
      amount: p.amount,
      paid_at: p.paid_at,
    }))
    const vat = allocateByPayments(finance.vatPayable, finance.price, payments)
    const profit = allocateByPayments(finance.netProfit, finance.price, payments)
    for (const payment of payments) {
      const month = monthKeyFromIso(payment.paid_at)
      if (!month) continue
      byMonth.set(
        month,
        addMetrics(byMonth.get(month) ?? EMPTY_NET_METRICS, {
          vatPayable: vat.get(payment.id) ?? 0,
          netProfit: profit.get(payment.id) ?? 0,
        }),
      )
    }
    return byMonth
  }

  const date = getDealAttributionDate(deal, mode)
  const month = date ? monthKeyFromIso(date) : null
  if (month) byMonth.set(month, { vatPayable: finance.vatPayable, netProfit: finance.netProfit })
  return byMonth
}

/** VAT payable and net profit per month over all deals counted in `mode`. */
export function aggregateMonthlyNetMetrics(
  deals: readonly RevenueDeal[],
  mode: StatisticType,
  paymentsByDeal: PaymentsByDeal,
  context: DealFinanceContext,
): Map<string, NetMetrics> {
  const totals = new Map<string, NetMetrics>()
  for (const deal of deals) {
    if (!isRevenueDeal(deal, mode)) continue
    for (const [month, metrics] of dealNetMetricsByMonth(deal, mode, paymentsByDeal, context)) {
      totals.set(month, addMetrics(totals.get(month) ?? EMPTY_NET_METRICS, metrics))
    }
  }
  return totals
}

/** Per deal id, the metrics that fall in `month` (rows of the month modal). */
export function netMetricsForMonthByDeal(
  deals: readonly RevenueDeal[],
  month: string,
  mode: StatisticType,
  paymentsByDeal: PaymentsByDeal,
  context: DealFinanceContext,
): Map<string, NetMetrics> {
  const rows = new Map<string, NetMetrics>()
  for (const deal of deals) {
    if (!deal.id || !isRevenueDeal(deal, mode)) continue
    const metrics = dealNetMetricsByMonth(deal, mode, paymentsByDeal, context).get(month)
    if (metrics) rows.set(deal.id, metrics)
  }
  return rows
}

export function sumNetMetrics(values: Iterable<NetMetrics>): NetMetrics {
  let total = EMPTY_NET_METRICS
  for (const value of values) total = addMetrics(total, value)
  return total
}

export interface RankedDeal<T extends RevenueDeal> {
  deal: T
  finance: DealFinance
}

/**
 * Most profitable projects first, by net profit (price without VAT minus
 * materials without VAT minus workers). Deals with nothing entered are left out.
 */
export function rankDealsByNetProfit<T extends RevenueDeal>(
  deals: readonly T[],
  context: DealFinanceContext,
  limit: number,
): RankedDeal<T>[] {
  return deals
    .map((deal) => ({ deal, finance: dealFinanceFor(deal, context) }))
    .filter(({ finance }) => finance.price > 0 || finance.materials > 0 || finance.labor > 0)
    .sort((a, b) => b.finance.netProfit - a.finance.netProfit)
    .slice(0, limit)
}
