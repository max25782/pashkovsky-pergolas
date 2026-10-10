const mockServerClient = jest.fn()
const mockSupabaseJsClient = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockServerClient(...args),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockSupabaseJsClient(...args),
}))

import { POST } from '@/app/api/subscriptions/change-plan/route'
import {
  SubscriptionMutationDisabledError,
  SubscriptionService,
} from '@/lib/services/subscription-service'

describe('POST /api/subscriptions/change-plan (disabled)', () => {
  beforeEach(() => {
    mockServerClient.mockClear()
    mockSupabaseJsClient.mockClear()
  })

  it('returns 403 and never opens a database client', async () => {
    const res = await POST()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining('disabled'),
    })
    expect(mockServerClient).not.toHaveBeenCalled()
    expect(mockSupabaseJsClient).not.toHaveBeenCalled()
  })
})

describe('SubscriptionService mutations (disabled)', () => {
  const service = new SubscriptionService()

  beforeEach(() => {
    mockServerClient.mockClear()
    mockSupabaseJsClient.mockClear()
  })

  it('changePlan rejects without touching the user client', async () => {
    await expect(
      service.changePlan('company-1', 'user-1', { new_plan_key: 'enterprise' }),
    ).rejects.toBeInstanceOf(SubscriptionMutationDisabledError)
    expect(mockServerClient).not.toHaveBeenCalled()
  })

  it('cancelSubscription rejects without touching the user client', async () => {
    await expect(
      service.cancelSubscription('company-1', 'user-1', 'reason', true),
    ).rejects.toBeInstanceOf(SubscriptionMutationDisabledError)
    expect(mockServerClient).not.toHaveBeenCalled()
  })
})
