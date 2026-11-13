jest.mock('@/lib/email', () => ({ sendEmail: jest.fn() }))
jest.mock('@/lib/whatsapp-send', () => ({ sendWhatsAppTemplate: jest.fn() }))

import {
  aggregateMonthlyDealStats,
  buildPaymentsByDeal,
  isRevenueDeal,
  sumRevenueDealTotals,
  type RevenueDeal,
} from '../revenue'
import { aggregateMonthlyNetMetrics } from '../deal-profit'
import { approvalTargetStage, resolverFor, stagesFromTemplate, type DealStageDef } from '../stages'
import { buildApprovalDealPatch, type DealForApproval } from '@/lib/offer-approval'

const contact = { customerName: 'Client', customerPhone: '0501234567' }
const NOW = '2026-11-13T10:00:00.000Z'

function deal(overrides: Partial<RevenueDeal>): RevenueDeal {
  return {
    id: 'd',
    customer_type: 'private',
    price: 0,
    my_cost: 0,
    installation_date: null,
    created_at: '2026-11-02T10:00:00.000Z',
    ...overrides,
  }
}

function approvalDeal(stage: string | null): DealForApproval {
  return { id: 'd1', source: null, stage, price: null, customer_phone: '', confirmed_date: null, created_by: 'u' }
}

describe('a construction firm with three columns (signed / in progress / completed)', () => {
  const stages = stagesFromTemplate('construction')
  const roleOf = resolverFor(stages)

  it('counts a deal as revenue from "signed" on', () => {
    expect(isRevenueDeal(deal({ stage: 'signed' }), 'all', roleOf)).toBe(true)
    expect(isRevenueDeal(deal({ stage: 'in_progress' }), 'all', roleOf)).toBe(true)
    expect(isRevenueDeal(deal({ stage: 'completed' }), 'all', roleOf)).toBe(true)
  })

  it('the legacy aluminium reading does not see these keys (so the firm needs its roles)', () => {
    expect(isRevenueDeal(deal({ stage: 'signed' }), 'all')).toBe(false)
  })

  it('moving a deal from signed to completed books its money in the installation month', () => {
    const signed = deal({ stage: 'signed', price: 10000, my_cost: 2000 })
    const completed = deal({
      stage: 'completed',
      price: 10000,
      my_cost: 2000,
      installation_date: '2026-11-13T10:00:00.000Z',
    })
    const none = new Map()

    expect(aggregateMonthlyDealStats([signed], 'money', none, 'en-US', roleOf).monthlyStats).toEqual([])
    const after = aggregateMonthlyDealStats([completed], 'money', none, 'en-US', roleOf).monthlyStats
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ month: '2026-11', revenue: 10000, expenses: 2000, profit: 8000, dealCount: 1 })
  })

  it('pipeline value counts signed and later deals', () => {
    const deals = [
      deal({ id: 'a', stage: 'signed', price: 100, my_cost: 10 }),
      deal({ id: 'b', stage: 'completed', price: 200, my_cost: 20 }),
      deal({ id: 'c', stage: 'unknown', price: 999, my_cost: 99 }),
    ]
    expect(sumRevenueDealTotals(deals, 'all', roleOf)).toEqual({ revenue: 300, expenses: 30 })
  })

  it('net profit follows the same roles', () => {
    const completed = deal({
      id: 'x',
      stage: 'completed',
      price: 11800,
      my_cost: 0,
      installation_date: '2026-11-13T10:00:00.000Z',
    })
    const metrics = aggregateMonthlyNetMetrics(
      [completed],
      'money',
      buildPaymentsByDeal([]),
      { vatPercent: 18, laborByDeal: {} },
      roleOf,
    )
    expect(metrics.get('2026-11')?.netProfit).toBeGreaterThan(0)
  })
})

describe('renaming a column does not change what the system does', () => {
  it('statistics use the role, so a renamed "completed" column still counts', () => {
    const stages: DealStageDef[] = stagesFromTemplate('repair').map((s) =>
      s.key === 'done' ? { ...s, label: 'Handed over', labels: null } : s,
    )
    const roleOf = resolverFor(stages)
    expect(isRevenueDeal(deal({ stage: 'done', installation_date: '2026-11-01' }), 'money', roleOf)).toBe(true)
  })

  it('a firm with no "completed" column simply has no completed deals (no error)', () => {
    const stages = stagesFromTemplate('construction').filter((s) => s.role !== 'completed')
    const roleOf = resolverFor(stages)
    expect(isRevenueDeal(deal({ stage: 'completed', installation_date: '2026-11-01' }), 'money', roleOf)).toBe(false)
    expect(() => aggregateMonthlyDealStats([deal({ stage: 'signed', price: 1 })], 'all', new Map(), 'en-US', roleOf)).not.toThrow()
  })
})

describe('Pashkovsky (aluminium) is unchanged', () => {
  const stages = stagesFromTemplate('aluminum')

  it('the default reading and the aluminium columns agree on every old key', () => {
    const roleOf = resolverFor(stages)
    for (const key of ['new', 'measure', 'offer', 'offer_approved', 'material_ordered', 'approved', 'production', 'install', 'done']) {
      for (const mode of ['all', 'money'] as const) {
        const d = deal({ stage: key, installation_date: '2026-11-01' })
        expect(isRevenueDeal(d, mode, roleOf)).toBe(isRevenueDeal(d, mode))
      }
    }
  })
})

describe('offer approval moves a deal to the firm\'s "signed" column', () => {
  it('aluminium: new, measure, offer and no stage move to offer_approved; later stages stay', () => {
    const al = stagesFromTemplate('aluminum')
    for (const stage of [null, 'new', 'measure', 'offer']) expect(approvalTargetStage(stage, al)).toBe('offer_approved')
    for (const stage of ['offer_approved', 'material_ordered', 'approved', 'production', 'install', 'done']) {
      expect(approvalTargetStage(stage, al)).toBeNull()
    }
  })

  it('repair firm: the new request moves to "estimate agreed"', () => {
    const repair = stagesFromTemplate('repair')
    expect(approvalTargetStage('request', repair)).toBe('estimate_agreed')
    expect(approvalTargetStage('in_progress', repair)).toBeNull()
  })

  it('construction firm: signed is the first column, a deal without a stage lands there', () => {
    const construction = stagesFromTemplate('construction')
    expect(approvalTargetStage(null, construction)).toBe('signed')
    expect(approvalTargetStage('signed', construction)).toBeNull()
  })

  it('a firm without a "signed" column keeps its deals where they are', () => {
    const stages = stagesFromTemplate('repair').filter((s) => s.role !== 'signed')
    expect(approvalTargetStage('request', stages)).toBeNull()
  })

  it('an unknown stage is never moved', () => {
    expect(approvalTargetStage('mystery', stagesFromTemplate('aluminum'))).toBeNull()
  })

  it('buildApprovalDealPatch uses the firm columns', () => {
    const repair = stagesFromTemplate('repair')
    expect(buildApprovalDealPatch(approvalDeal('request'), { final_price: 1 }, contact, NOW, repair)).toEqual({
      stage: 'estimate_agreed',
    })
    // default (no columns passed) keeps the aluminium behaviour
    expect(buildApprovalDealPatch(approvalDeal('offer'), { final_price: 1 }, contact, NOW)).toEqual({
      stage: 'offer_approved',
    })
  })
})
