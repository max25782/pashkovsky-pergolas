import type { Deal } from '../deal-types'
import {
  aggregateMonthlyDealStats,
  buildPaymentsByDeal,
  getMonthDealRows,
  isRevenueDeal,
  type DealPayment,
  type StatisticType,
} from '../deal-utils'

function deal(overrides: Partial<Deal>): Deal {
  return {
    id: overrides.id ?? 'deal',
    customer_name: overrides.customer_name ?? 'Client',
    customer_type: overrides.customer_type ?? 'private',
    stage: overrides.stage ?? 'new',
    price: overrides.price ?? 0,
    my_cost: overrides.my_cost ?? 0,
    installation_date: overrides.installation_date ?? null,
    order_date: overrides.order_date ?? null,
    created_at: overrides.created_at ?? '2026-01-15T10:00:00.000Z',
    ...overrides,
  }
}

const FIXTURE_DEALS: Deal[] = [
  deal({ id: 'new-priced', stage: 'new', price: 10000, my_cost: 1000, created_at: '2026-03-01T00:00:00.000Z' }),
  deal({ id: 'quote-priced', stage: 'offer', price: 18800, my_cost: 2000, created_at: '2026-03-02T00:00:00.000Z' }),
  deal({ id: 'offer-approved', stage: 'offer_approved', price: 37940, my_cost: 3000, created_at: '2026-03-03T00:00:00.000Z' }),
  deal({ id: 'measure-priced', stage: 'measure', price: 30000, my_cost: 4000, created_at: '2026-03-04T00:00:00.000Z' }),
  deal({ id: 'approved-extra', stage: 'approved', price: 50000, my_cost: 5000, created_at: '2026-03-05T00:00:00.000Z' }),
  deal({
    id: 'material-ordered',
    stage: 'material_ordered',
    price: 40000,
    my_cost: 8000,
    order_date: '2026-04-10T00:00:00.000Z',
  }),
  deal({
    id: 'production',
    stage: 'production',
    price: 22000,
    my_cost: 6000,
    created_at: '2026-04-12T00:00:00.000Z',
  }),
  deal({
    id: 'install',
    stage: 'install',
    price: 15000,
    my_cost: 3000,
    installation_date: '2026-05-08T00:00:00.000Z',
  }),
  deal({
    id: 'done-installed',
    stage: 'done',
    price: 80000,
    my_cost: 20000,
    installation_date: '2026-05-20T00:00:00.000Z',
  }),
  deal({
    id: 'done-no-install',
    stage: 'done',
    price: 9000,
    my_cost: 1000,
    installation_date: null,
    created_at: '2026-05-21T00:00:00.000Z',
  }),
  deal({
    id: 'contractor',
    stage: 'production',
    customer_type: 'contractor',
    price: 999999,
    my_cost: 111111,
  }),
  deal({
    id: 'dateless-revenue',
    stage: 'material_ordered',
    price: 12000,
    my_cost: 2000,
    installation_date: null,
    order_date: null,
    created_at: null,
  }),
]

const FIXTURE_PAYMENTS: DealPayment[] = [
  { deal_id: 'contractor', amount: 25000, paid_at: '2026-05-03T00:00:00.000Z' },
  { deal_id: 'contractor', amount: 15000, paid_at: '2026-06-01T00:00:00.000Z' },
]

function statsFor(mode: StatisticType, deals = FIXTURE_DEALS, payments = FIXTURE_PAYMENTS) {
  return aggregateMonthlyDealStats(deals, mode, buildPaymentsByDeal(payments), 'en-US')
}

function totalsOf(mode: StatisticType, deals = FIXTURE_DEALS, payments = FIXTURE_PAYMENTS) {
  const { monthlyStats, datelessCount } = statsFor(mode, deals, payments)
  return monthlyStats.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      expenses: acc.expenses + row.expenses,
      profit: acc.profit + row.profit,
      dealCount: acc.dealCount + row.dealCount,
      datelessCount,
    }),
    { revenue: 0, expenses: 0, profit: 0, dealCount: 0, datelessCount },
  )
}

describe('isRevenueDeal', () => {
  it('excludes unsigned early stages from mode all', () => {
    expect(isRevenueDeal(deal({ id: '1', stage: 'new', price: 1 }), 'all')).toBe(false)
    expect(isRevenueDeal(deal({ id: '2', stage: 'measure', price: 1 }), 'all')).toBe(false)
    expect(isRevenueDeal(deal({ id: '3', stage: 'offer', price: 1 }), 'all')).toBe(false)
  })

  it('includes signed offer and every later stage in mode all', () => {
    expect(isRevenueDeal(deal({ id: '1', stage: 'offer_approved' }), 'all')).toBe(true)
    expect(isRevenueDeal(deal({ id: '2', stage: 'material_ordered' }), 'all')).toBe(true)
    expect(isRevenueDeal(deal({ id: '3', stage: 'approved' }), 'all')).toBe(true)
    expect(isRevenueDeal(deal({ id: '4', stage: 'production' }), 'all')).toBe(true)
    expect(isRevenueDeal(deal({ id: '5', stage: 'install' }), 'all')).toBe(true)
    expect(isRevenueDeal(deal({ id: '6', stage: 'done' }), 'all')).toBe(true)
  })

  it('keeps money rules: done+installation for private, all contractors', () => {
    expect(isRevenueDeal(deal({ id: '1', stage: 'done', installation_date: '2026-01-01' }), 'money')).toBe(true)
    expect(isRevenueDeal(deal({ id: '2', stage: 'done', installation_date: null }), 'money')).toBe(false)
    expect(isRevenueDeal(deal({ id: '3', stage: 'install', installation_date: '2026-01-01' }), 'money')).toBe(false)
    expect(isRevenueDeal(deal({ id: '4', stage: 'new', customer_type: 'contractor' }), 'money')).toBe(true)
  })
})

describe('mode all revenue filter', () => {
  const baseline = totalsOf('all')

  it('does not change when a new or quote deal with price is added', () => {
    const extra = [
      ...FIXTURE_DEALS,
      deal({ id: 'extra-new', stage: 'new', price: 77777, created_at: '2026-04-01T00:00:00.000Z' }),
      deal({ id: 'extra-quote', stage: 'offer', price: 88888, created_at: '2026-04-02T00:00:00.000Z' }),
    ]
    expect(totalsOf('all', extra)).toEqual(baseline)
  })

  it('changes when offer_approved and later stages are added', () => {
    for (const stage of ['offer_approved', 'material_ordered', 'approved', 'production', 'install', 'done'] as const) {
      const extra = [
        ...FIXTURE_DEALS,
        deal({
          id: `extra-${stage}`,
          stage,
          price: 1000,
          my_cost: 100,
          installation_date: '2026-07-01T00:00:00.000Z',
          created_at: '2026-07-01T00:00:00.000Z',
        }),
      ]
      const next = totalsOf('all', extra)
      expect(next.revenue).toBe(baseline.revenue + 1000)
      expect(next.expenses).toBe(baseline.expenses + 100)
      expect(next.dealCount).toBe(baseline.dealCount + 1)
    }
  })

  it('counts dateless material_ordered+ deals instead of dropping them', () => {
    expect(baseline.datelessCount).toBe(1)
  })
})

describe('mode money snapshot', () => {
  const moneySnapshot = totalsOf('money')

  it('does not change for any fixture deal mutation of early stages or missing installation', () => {
    const mutated = FIXTURE_DEALS.map((item) =>
      item.id === 'new-priced' || item.id === 'quote-priced'
        ? { ...item, price: (item.price ?? 0) + 50000, stage: 'offer' as const }
        : item,
    )
    expect(totalsOf('money', mutated)).toEqual(moneySnapshot)
  })

  it('matches the frozen money totals on the fixture', () => {
    expect(moneySnapshot).toMatchInlineSnapshot(`
      {
        "datelessCount": 0,
        "dealCount": 3,
        "expenses": 20000,
        "profit": 100000,
        "revenue": 120000,
      }
    `)
  })
})

describe('modal totals match the month table row', () => {
  it('equals for April and May in both modes', () => {
    const paymentsByDeal = buildPaymentsByDeal(FIXTURE_PAYMENTS)

    for (const mode of ['all', 'money'] as const) {
      const { monthlyStats } = aggregateMonthlyDealStats(FIXTURE_DEALS, mode, paymentsByDeal, 'en-US')
      for (const row of monthlyStats) {
        const modal = getMonthDealRows(FIXTURE_DEALS, row.month, mode, paymentsByDeal)
        expect(modal.totals).toEqual({
          revenue: row.revenue,
          expenses: row.expenses,
          profit: row.profit,
          dealCount: row.dealCount,
        })
      }
    }
  })

  it('uses contractor payments in money mode, not deal.price', () => {
    const modal = getMonthDealRows(
      FIXTURE_DEALS,
      '2026-05',
      'money',
      buildPaymentsByDeal(FIXTURE_PAYMENTS),
    )
    const contractor = modal.rows.find((row) => row.deal.id === 'contractor')
    expect(contractor?.revenue).toBe(25000)
    expect(contractor?.expenses).toBe(0)
  })
})
