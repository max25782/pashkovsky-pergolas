/**
 * @jest-environment node
 *
 * Continuing a foreign AI Director sessionId must 404.
 */
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.AI_DIRECTOR_API_TOKEN = 'test-token'
process.env.NEXT_PUBLIC_APP_URL = 'https://crm.example.com'

const CO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SESSION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001'

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({
    authorized: true,
    user: { id: 'user-a', email: 'a@example.com' },
    context: { userId: 'user-a', email: 'a@example.com', companyId: CO_A },
  })),
}))

jest.mock('@/lib/middleware/ai-director-subscription', () => ({
  checkAIDirectorAccess: jest.fn(async () => null),
}))

jest.mock('@/lib/middleware/rate-limit', () => ({
  aiDirectorLimiter: {},
  aiDirectorUserLimiter: {},
  checkLimit: jest.fn(async () => ({ allowed: true, remaining: 10, retryAfter: 0 })),
}))

jest.mock('@/lib/ai/bedrock-client', () => ({
  callBedrockAgent: jest.fn(),
}))

jest.mock('@/lib/ai/business-snapshot', () => ({
  buildBusinessSnapshot: jest.fn(() => 'snap'),
  readSnapshotCache: jest.fn(() => null),
  writeSnapshotCache: jest.fn(),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from(table: string) {
      if (table === 'company_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { role: 'owner' }, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'ai_director_sessions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'new-session' }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
              limit: async () => ({ data: [], error: null }),
            }),
            limit: async () => ({ data: [], error: null }),
          }),
        }),
      }
    },
  })),
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'

describe('AI Director session ownership', () => {
  it('POST with foreign sessionId returns 404', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/ai-director/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'שלום', sessionId: SESSION_B }),
      }),
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Session not found')
  })
})
