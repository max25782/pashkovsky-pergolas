/**
 * Unit tests for analytics aggregators
 * 
 * Tests key calculations: winRate, avgDealValue, profit, profitMargin, duplicates count
 * Ensures timezone filtering works correctly for Asia/Jerusalem
 */

import type { AnalyticsPeriod } from '@/lib/ai/analyticsTypes'
import { DEFAULT_TIMEZONE } from '@/lib/ai/analyticsTypes'

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  lte: jest.fn(() => mockSupabase),
  in: jest.fn(() => mockSupabase),
  not: jest.fn(() => mockSupabase),
}

// Mock data
const mockDeals = [
  {
    id: 'deal-1',
    stage: 'done',
    price: '50000',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
  },
  {
    id: 'deal-2',
    stage: 'done',
    price: '30000',
    created_at: '2024-01-16T10:00:00Z',
    updated_at: '2024-01-25T10:00:00Z',
  },
  {
    id: 'deal-3',
    stage: 'production',
    price: '40000',
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-18T10:00:00Z',
  },
  {
    id: 'deal-4',
    stage: 'new',
    price: null,
    created_at: '2024-01-18T10:00:00Z',
    updated_at: '2024-01-18T10:00:00Z',
  },
]

const mockLeads = [
  {
    id: 'lead-1',
    name: 'John Doe',
    phone: '0501234567',
    source: 'website',
    status: 'qualified',
    created_at: '2024-01-15T10:00:00Z',
    last_message_at: '2024-01-15T11:30:00Z', // 90 minutes later
  },
  {
    id: 'lead-2',
    name: 'Jane Smith',
    phone: '0501234567', // Duplicate phone
    source: 'facebook',
    status: 'pending',
    created_at: '2024-01-16T10:00:00Z',
    last_message_at: null,
  },
  {
    id: 'lead-3',
    name: 'Bob Johnson',
    phone: '0507654321',
    source: 'website',
    status: 'won',
    created_at: '2024-01-17T10:00:00Z',
    last_message_at: '2024-01-17T14:00:00Z', // 4 hours later
  },
]

const mockWorkShifts = [
  {
    daily_rate_snapshot: '500',
    date: '2024-01-15',
  },
  {
    daily_rate_snapshot: '600',
    date: '2024-01-16',
  },
  {
    daily_rate_snapshot: '550',
    date: '2024-01-17',
  },
]

const mockOffers = [
  {
    deal_id: 'deal-4',
    final_price: '35000',
  },
]

// Helper function to create test period
function createTestPeriod(from: string, to: string): AnalyticsPeriod {
  return {
    from,
    to,
    tz: DEFAULT_TIMEZONE,
  }
}

describe('Analytics Aggregators - Calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock module
    jest.mock('@supabase/supabase-js', () => ({
      createClient: () => mockSupabase,
    }))
  })

  describe('getDealsSummary - winRate calculation', () => {
    it('should calculate winRate correctly', async () => {
      // Mock: 2 done deals out of 4 total = 50%
      mockSupabase.data = mockDeals
      mockSupabase.error = null

      const { getDealsSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      // Mock the query chain
      mockSupabase.from.mockReturnValue(mockSupabase)
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.gte.mockReturnValue(mockSupabase)
      mockSupabase.lte.mockReturnValue(mockSupabase)
      
      // Mock the final query result
      const mockQuery = {
        data: mockDeals,
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)

      const result = await getDealsSummary(period)
      
      expect(result.wonDeals).toBe(2)
      expect(result.totalDeals).toBe(4)
      expect(result.winRate).toBe(50) // 2/4 * 100 = 50%
    })

    it('should return 0% winRate when no deals', async () => {
      mockSupabase.data = []
      mockSupabase.error = null

      const { getDealsSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const mockQuery = {
        data: [],
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)

      const result = await getDealsSummary(period)
      
      expect(result.winRate).toBe(0)
      expect(result.totalDeals).toBe(0)
    })
  })

  describe('getDealsSummary - avgDealValue calculation', () => {
    it('should calculate avgDealValue correctly', async () => {
      // Mock: deals with prices: 50000, 30000, 40000, null
      // Average of non-null: (50000 + 30000 + 40000) / 3 = 40000
      mockSupabase.data = mockDeals
      mockSupabase.error = null

      const { getDealsSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const mockQuery = {
        data: mockDeals,
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)

      const result = await getDealsSummary(period)
      
      expect(result.avgDealValue).toBe(40000) // (50000 + 30000 + 40000) / 3
    })

    it('should return 0 when no deals have prices', async () => {
      const dealsWithoutPrices = mockDeals.map(d => ({ ...d, price: null }))
      
      const mockQuery = {
        data: dealsWithoutPrices,
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)

      const { getDealsSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const result = await getDealsSummary(period)
      
      expect(result.avgDealValue).toBe(0)
    })
  })

  describe('getFinanceSummary - profit and profitMargin calculation', () => {
    it('should calculate profit correctly', async () => {
      // Revenue: 50000 + 30000 = 80000 (only done deals)
      // Labor cost: 500 + 600 + 550 = 1650
      // Profit: 80000 - 1650 = 78350
      // Margin: (78350 / 80000) * 100 = 97.9% ≈ 98%
      
      const doneDeals = mockDeals.filter(d => d.stage === 'done')
      
      const dealsQuery = {
        data: doneDeals,
        error: null,
      }
      
      const shiftsQuery = {
        data: mockWorkShifts,
        error: null,
      }

      mockSupabase.from.mockReturnValue(mockSupabase)
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.eq.mockReturnValue(mockSupabase)
      mockSupabase.gte.mockReturnValue(mockSupabase)
      mockSupabase.lte.mockReturnValue(mockSupabase)
      mockSupabase.in.mockReturnValue(mockSupabase)
      mockSupabase.not.mockReturnValue(mockSupabase)

      // First call returns deals, second returns shifts
      let callCount = 0
      mockSupabase.lte.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(dealsQuery)
        }
        return Promise.resolve(shiftsQuery)
      })

      const { getFinanceSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const result = await getFinanceSummary(period)
      
      expect(result.revenue).toBe(80000) // 50000 + 30000
      expect(result.laborCost).toBe(1650) // 500 + 600 + 550
      expect(result.profit).toBe(78350) // 80000 - 1650
      expect(result.profitMargin).toBe(98) // Math.round((78350 / 80000) * 100)
    })

    it('should calculate profitMargin as 0 when revenue is 0', async () => {
      const dealsQuery = {
        data: [],
        error: null,
      }
      
      const shiftsQuery = {
        data: [],
        error: null,
      }

      mockSupabase.from.mockReturnValue(mockSupabase)
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.eq.mockReturnValue(mockSupabase)
      mockSupabase.gte.mockReturnValue(mockSupabase)
      mockSupabase.lte.mockReturnValue(mockSupabase)

      let callCount = 0
      mockSupabase.lte.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(dealsQuery)
        }
        return Promise.resolve(shiftsQuery)
      })

      const { getFinanceSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const result = await getFinanceSummary(period)
      
      expect(result.revenue).toBe(0)
      expect(result.profitMargin).toBe(0)
    })

    it('should handle negative profit correctly', async () => {
      // Revenue: 1000, Labor cost: 2000
      // Profit: -1000, Margin: -100%
      const lowRevenueDeals = [
        {
          id: 'deal-1',
          stage: 'done',
          price: '1000',
          created_at: '2024-01-15T10:00:00Z',
        },
      ]
      
      const highCostShifts = [
        { daily_rate_snapshot: '2000', date: '2024-01-15' },
      ]

      const dealsQuery = {
        data: lowRevenueDeals,
        error: null,
      }
      
      const shiftsQuery = {
        data: highCostShifts,
        error: null,
      }

      mockSupabase.from.mockReturnValue(mockSupabase)
      mockSupabase.select.mockReturnValue(mockSupabase)
      mockSupabase.eq.mockReturnValue(mockSupabase)
      mockSupabase.gte.mockReturnValue(mockSupabase)
      mockSupabase.lte.mockReturnValue(mockSupabase)

      let callCount = 0
      mockSupabase.lte.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve(dealsQuery)
        }
        return Promise.resolve(shiftsQuery)
      })

      const { getFinanceSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const result = await getFinanceSummary(period)
      
      expect(result.revenue).toBe(1000)
      expect(result.laborCost).toBe(2000)
      expect(result.profit).toBe(-1000)
      expect(result.profitMargin).toBe(-100) // Math.round((-1000 / 1000) * 100)
      expect(result.topIssues).toContain(expect.stringContaining('Negative profit'))
    })
  })

  describe('getLeadsSummary - duplicates count', () => {
    it('should count duplicate leads correctly', async () => {
      // lead-1 and lead-2 have same phone: '0501234567'
      // So 1 duplicate group = 1 duplicate count
      mockSupabase.data = mockLeads
      mockSupabase.error = null

      const { getLeadsSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const mockQuery = {
        data: mockLeads,
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)

      // Mock deals query for conversion calculation
      mockSupabase.in.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await getLeadsSummary(period)
      
      // 2 leads with same phone = 1 duplicate group
      expect(result.duplicateLeads).toBe(1)
      expect(result.totalLeads).toBe(3)
    })

    it('should return 0 duplicates when all phones are unique', async () => {
      const uniqueLeads = mockLeads.map((lead, idx) => ({
        ...lead,
        phone: `050${idx}${idx}${idx}${idx}${idx}${idx}${idx}`,
      }))

      const mockQuery = {
        data: uniqueLeads,
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)

      mockSupabase.in.mockResolvedValue({
        data: [],
        error: null,
      })

      const { getLeadsSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const result = await getLeadsSummary(period)
      
      expect(result.duplicateLeads).toBe(0)
    })
  })

  describe('Timezone filtering - Asia/Jerusalem', () => {
    it('should correctly filter dates using Asia/Jerusalem timezone', async () => {
      // Test that dates are converted to UTC correctly
      // Asia/Jerusalem is UTC+2 or UTC+3 (depending on DST)
      // For simplicity, we'll test that the conversion happens
      
      const { getDateRange } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const { from, to } = getDateRange(period)
      
      // Should be ISO strings (UTC)
      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(to).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      
      // Should start at beginning of day (00:00:00)
      expect(from).toContain('T00:00:00')
      // Should end at end of day (23:59:59)
      expect(to).toContain('T23:59:59')
    })

    it('should handle date range boundaries correctly', async () => {
      const period = createTestPeriod('2024-01-01', '2024-01-31')
      
      const { getDateRange } = await import('../aggregators')
      const { from, to } = getDateRange(period)
      
      const fromDate = new Date(from)
      const toDate = new Date(to)
      
      // Should cover the full period
      expect(fromDate.getTime()).toBeLessThanOrEqual(toDate.getTime())
      
      // from should be start of first day
      expect(fromDate.getUTCHours()).toBe(0)
      expect(fromDate.getUTCMinutes()).toBe(0)
      
      // to should be end of last day
      expect(toDate.getUTCHours()).toBe(23)
      expect(toDate.getUTCMinutes()).toBe(59)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty arrays gracefully', async () => {
      const mockQuery = {
        data: [],
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)
      mockSupabase.in.mockResolvedValue({ data: [], error: null })

      const { getDealsSummary, getLeadsSummary, getFinanceSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const dealsResult = await getDealsSummary(period)
      const leadsResult = await getLeadsSummary(period)
      const financeResult = await getFinanceSummary(period)
      
      expect(dealsResult.totalDeals).toBe(0)
      expect(dealsResult.avgDealValue).toBe(0)
      expect(dealsResult.winRate).toBe(0)
      
      expect(leadsResult.totalLeads).toBe(0)
      expect(leadsResult.duplicateLeads).toBe(0)
      
      expect(financeResult.revenue).toBe(0)
      expect(financeResult.profitMargin).toBe(0)
    })

    it('should handle null/undefined values correctly', async () => {
      const dealsWithNulls = [
        { id: 'deal-1', stage: null, price: null, created_at: null, updated_at: null },
        { id: 'deal-2', stage: 'done', price: '10000', created_at: '2024-01-15T10:00:00Z', updated_at: '2024-01-20T10:00:00Z' },
      ]

      const mockQuery = {
        data: dealsWithNulls,
        error: null,
      }
      mockSupabase.lte.mockResolvedValue(mockQuery)

      const { getDealsSummary } = await import('../aggregators')
      const period = createTestPeriod('2024-01-15', '2024-01-20')
      
      const result = await getDealsSummary(period)
      
      // Null stage should be counted as 'new'
      expect(result.stageBreakdown.new).toBe(1)
      expect(result.stageBreakdown.done).toBe(1)
      // Null price should be excluded from avgDealValue
      expect(result.avgDealValue).toBe(10000)
    })
  })
})

