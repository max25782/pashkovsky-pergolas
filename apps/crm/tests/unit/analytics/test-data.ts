/**
 * Test data for analytics aggregators
 * 
 * This file contains mock data that can be used for manual testing
 * or as seed data for test database
 */

export const mockDealsData = [
  {
    id: 'deal-test-1',
    stage: 'done',
    price: '50000',
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
  },
  {
    id: 'deal-test-2',
    stage: 'done',
    price: '30000',
    created_at: '2024-01-16T10:00:00Z',
    updated_at: '2024-01-25T10:00:00Z',
  },
  {
    id: 'deal-test-3',
    stage: 'production',
    price: '40000',
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-18T10:00:00Z',
  },
  {
    id: 'deal-test-4',
    stage: 'new',
    price: null,
    created_at: '2024-01-18T10:00:00Z',
    updated_at: '2024-01-18T10:00:00Z',
  },
]

export const mockLeadsData = [
  {
    id: 'lead-test-1',
    name: 'John Doe',
    phone: '0501234567',
    source: 'website',
    status: 'qualified',
    created_at: '2024-01-15T10:00:00Z',
    last_message_at: '2024-01-15T11:30:00Z', // 90 minutes later
  },
  {
    id: 'lead-test-2',
    name: 'Jane Smith',
    phone: '0501234567', // Duplicate phone
    source: 'facebook',
    status: 'pending',
    created_at: '2024-01-16T10:00:00Z',
    last_message_at: null,
  },
  {
    id: 'lead-test-3',
    name: 'Bob Johnson',
    phone: '0507654321',
    source: 'website',
    status: 'won',
    created_at: '2024-01-17T10:00:00Z',
    last_message_at: '2024-01-17T14:00:00Z', // 4 hours later
  },
]

export const mockWorkShiftsData = [
  {
    id: 'shift-test-1',
    project_id: 'deal-test-1',
    worker_id: 'worker-test-1',
    date: '2024-01-15',
    daily_rate_snapshot: '500',
  },
  {
    id: 'shift-test-2',
    project_id: 'deal-test-2',
    worker_id: 'worker-test-2',
    date: '2024-01-16',
    daily_rate_snapshot: '600',
  },
  {
    id: 'shift-test-3',
    project_id: 'deal-test-3',
    worker_id: 'worker-test-1',
    date: '2024-01-17',
    daily_rate_snapshot: '550',
  },
]

export const mockOffersData = [
  {
    id: 'offer-test-1',
    deal_id: 'deal-test-4',
    final_price: '35000',
    created_at: '2024-01-18T10:00:00Z',
  },
]

/**
 * Expected results for test data
 */
export const expectedResults = {
  deals: {
    totalDeals: 4,
    wonDeals: 2,
    openDeals: 2,
    winRate: 50, // 2/4 * 100
    avgDealValue: 40000, // (50000 + 30000 + 40000) / 3
  },
  leads: {
    totalLeads: 3,
    duplicateLeads: 1, // One phone appears twice
    avgResponseTimeMinutes: 165, // Average of 90 and 240 minutes
  },
  finance: {
    revenue: 80000, // 50000 + 30000 (only done deals)
    laborCost: 1650, // 500 + 600 + 550
    profit: 78350, // 80000 - 1650
    profitMargin: 98, // Math.round((78350 / 80000) * 100)
  },
}

