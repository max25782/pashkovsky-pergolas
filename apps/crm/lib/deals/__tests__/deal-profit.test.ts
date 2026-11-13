import {
  aggregateMonthlyNetMetrics,
  netMetricsForMonthByDeal,
  rankDealsByNetProfit,
  sumNetMetrics,
  type DealFinanceContext,
} from '../deal-profit'
import { buildPaymentsByDeal, type RevenueDeal } from '../revenue'

const context: DealFinanceContext = {
  vatPercent: 18,
  laborByDeal: { big: 10000, discounted: 20000, plain: 5000 },
}

function deal(overrides: Partial<RevenueDeal> & { id: string }): RevenueDeal {
  return {
    stage: 'done',
    customer_type: 'private',
    customer_name: overrides.id,
    installation_date: '2026-10-20T00:00:00Z',
    ...overrides,
  }
}

const BIG = deal({ id: 'big', price: 118000, my_cost: 59000 })
const DISCOUNTED = deal({ id: 'discounted', price: 106200, my_cost: 40000 })
const PLAIN = deal({ id: 'plain', price: 59000, my_cost: null, installation_date: '2026-11-05T00:00:00Z' })

describe('monthly VAT payable and net profit', () => {
  it('sums the three reference deals per attribution month', () => {
    const byMonth = aggregateMonthlyNetMetrics([BIG, DISCOUNTED, PLAIN], 'money', new Map(), context)
    // October: big (9 000 / 40 000) + discounted (10 098.31 / 36 101.69)
    expect(byMonth.get('2026-10')).toEqual({ vatPayable: 19098.31, netProfit: 76101.69 })
    // November: no materials, 5 000 workers
    expect(byMonth.get('2026-11')).toEqual({ vatPayable: 9000, netProfit: 45000 })
  })

  it('totals match the sum of the months', () => {
    const byMonth = aggregateMonthlyNetMetrics([BIG, DISCOUNTED, PLAIN], 'money', new Map(), context)
    expect(sumNetMetrics(byMonth.values())).toEqual({ vatPayable: 28098.31, netProfit: 121101.69 })
  })

  it('a contractor deal is split over the months its payments arrived in', () => {
    const contractor = deal({ id: 'big', customer_type: 'contractor', price: 118000, my_cost: 59000 })
    const payments = buildPaymentsByDeal([
      { deal_id: 'big', amount: 47200, paid_at: '2026-10-28T10:00:00Z' },
      { deal_id: 'big', amount: 70800, paid_at: '2026-11-03T10:00:00Z' },
    ])
    const byMonth = aggregateMonthlyNetMetrics([contractor], 'money', payments, context)
    expect(byMonth.get('2026-10')).toEqual({ vatPayable: 3600, netProfit: 16000 })
    expect(byMonth.get('2026-11')).toEqual({ vatPayable: 5400, netProfit: 24000 })
  })

  it('month rows only contain the deals of that month', () => {
    const rows = netMetricsForMonthByDeal([BIG, PLAIN], '2026-11', 'money', new Map(), context)
    expect([...rows.keys()]).toEqual(['plain'])
  })
})

describe('profit ranking', () => {
  it('orders projects by net profit, not by price', () => {
    // plain has the lowest price but the best net profit (45 000 vs 40 000 and 36 101.69).
    const ranked = rankDealsByNetProfit([BIG, DISCOUNTED, PLAIN], context, 10)
    expect(ranked.map((r) => r.deal.id)).toEqual(['plain', 'big', 'discounted'])
    expect(ranked[0].finance.netProfit).toBe(45000)
  })

  it('leaves out deals with nothing entered and honours the limit', () => {
    const empty = deal({ id: 'empty', price: null, my_cost: null })
    expect(rankDealsByNetProfit([empty], context, 10)).toEqual([])
    expect(rankDealsByNetProfit([BIG, DISCOUNTED, PLAIN], context, 2)).toHaveLength(2)
  })
})
