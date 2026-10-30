import {
  aggregateMonthlyDealStats,
  buildMoneyMonthReport,
  buildPaymentsByDeal,
  sumRevenueDealTotals,
  type DealPayment,
  type RevenueDeal,
} from '../revenue'

function deal(overrides: Partial<RevenueDeal>): RevenueDeal {
  return {
    id: overrides.id ?? 'deal',
    customer_name: overrides.customer_name ?? 'Client',
    customer_type: overrides.customer_type ?? 'private',
    stage: overrides.stage ?? 'new',
    price: overrides.price ?? 0,
    my_cost: overrides.my_cost ?? 0,
    installation_date: overrides.installation_date ?? null,
    created_at: overrides.created_at ?? '2026-01-15T10:00:00.000Z',
    ...overrides,
  }
}

describe('sumRevenueDealTotals — AI director totalValue (mode all)', () => {
  it('does not include a draft (new/offer) with price > 0 in totalValue', () => {
    const deals = [
      deal({ id: 'draft-new', stage: 'new', price: 18800, my_cost: 1000 }),
      deal({ id: 'draft-offer', stage: 'offer', price: 37940, my_cost: 2000 }),
      deal({ id: 'signed', stage: 'offer_approved', price: 40000, my_cost: 5000 }),
    ]
    expect(sumRevenueDealTotals(deals, 'all')).toEqual({ revenue: 40000, expenses: 5000 })
  })
})

describe('monthly report == statistics money row', () => {
  const deals: RevenueDeal[] = [
    deal({
      id: 'done-installed',
      stage: 'done',
      price: 80000,
      my_cost: 20000,
      installation_date: '2026-05-20T00:00:00.000Z',
    }),
    deal({
      id: 'contractor',
      stage: 'production',
      customer_type: 'contractor',
      customer_name: 'קבלן',
      price: 999999,
      my_cost: 111111,
    }),
    deal({
      id: 'draft',
      stage: 'new',
      price: 50000,
      my_cost: 1000,
      created_at: '2026-05-01T00:00:00.000Z',
    }),
  ]
  const payments: DealPayment[] = [
    { deal_id: 'contractor', amount: 25000, paid_at: '2026-05-03T00:00:00.000Z' },
    { deal_id: 'contractor', amount: 15000, paid_at: '2026-06-01T00:00:00.000Z' },
  ]

  it('May totals match the statistics month row, including the contractor', () => {
    const paymentsByDeal = buildPaymentsByDeal(payments)
    const stats = aggregateMonthlyDealStats(deals, 'money', paymentsByDeal, 'en-US')
    const may = stats.monthlyStats.find((row) => row.month === '2026-05')
    const report = buildMoneyMonthReport(deals, '2026-05', paymentsByDeal)

    expect(may).toBeDefined()
    expect(report.totalRevenue).toBe(may?.revenue)
    expect(report.totalLaborCost).toBe(may?.expenses)
    expect(report.totalProfit).toBe(may?.profit)
    expect(report.projects).toHaveLength(may?.dealCount ?? -1)
    expect(report.totalRevenue).toBe(105000)
    expect(report.projects.find((p) => p.projectId === 'contractor')?.revenue).toBe(25000)
  })
})
