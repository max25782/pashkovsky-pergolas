/**
 * @jest-environment node
 *
 * Company A must not read, continue, or delete company B AI sessions
 * even when session_id is known.
 */
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'

const CO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const CO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SESSION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbb0001'

const state = {
  callerCompanyId: CO_A as string,
  lastSessionsEq: [] as Array<{ col: string; val: unknown }>,
  lastDeleteEq: [] as Array<{ col: string; val: unknown }>,
  ownedLookup: null as { id: string; client_id: string; company_id: string } | null,
}

jest.mock('@/lib/middleware/auth-async', () => ({
  requireAuthAsync: jest.fn(async () => ({
    authorized: true,
    user: { id: 'user-a', email: 'a@example.com' },
    context: { userId: 'user-a', email: 'a@example.com', companyId: state.callerCompanyId },
  })),
}))

jest.mock('@/lib/ai-chat/session-company', () => ({
  getOwnedAiSession: jest.fn(async (_sb: unknown, sessionId: string, companyId: string) => {
    if (state.ownedLookup && state.ownedLookup.id === sessionId && state.ownedLookup.company_id === companyId) {
      return state.ownedLookup
    }
    return null
  }),
}))

function listChain() {
  const eqs: Array<{ col: string; val: unknown }> = []
  const chain: Record<string, unknown> = {
    select: jest.fn(() => chain),
    eq: jest.fn((col: string, val: unknown) => {
      eqs.push({ col, val })
      return chain
    }),
    ilike: jest.fn(() => chain),
    order: jest.fn(() => chain),
    range: jest.fn(() => chain),
    then: (onfulfilled: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) => {
      state.lastSessionsEq = [...eqs]
      return Promise.resolve({ data: [], error: null, count: 0 }).then(onfulfilled, onrejected)
    },
  }
  return chain
}

function deleteChain() {
  const eqs: Array<{ col: string; val: unknown }> = []
  const chain: Record<string, unknown> = {
    eq: jest.fn((col: string, val: unknown) => {
      eqs.push({ col, val })
      return chain
    }),
    then: (onfulfilled: (v: unknown) => unknown, onrejected?: (e: unknown) => unknown) => {
      state.lastDeleteEq = [...eqs]
      return Promise.resolve({ error: null }).then(onfulfilled, onrejected)
    },
  }
  return {
    delete: jest.fn(() => chain),
  }
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from(table: string) {
      if (table === 'ai_sessions') {
        return {
          select: () => listChain(),
          delete: () => deleteChain().delete(),
        }
      }
      if (table === 'ai_messages') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected ${table}`)
    },
  })),
}))

import { NextRequest } from 'next/server'
import { GET, DELETE } from '../route'
import { getOwnedAiSession } from '@/lib/ai-chat/session-company'

describe('admin-api/ai-chats company isolation', () => {
  beforeEach(() => {
    state.callerCompanyId = CO_A
    state.ownedLookup = null
    state.lastSessionsEq = []
    state.lastDeleteEq = []
    jest.clearAllMocks()
  })

  it('lists only sessions for caller company_id', async () => {
    const res = await GET(new NextRequest('http://localhost/admin-api/ai-chats'))
    expect(res.status).toBe(200)
    expect(state.lastSessionsEq).toEqual(
      expect.arrayContaining([{ col: 'company_id', val: CO_A }]),
    )
  })

  it('returns 404 when reading company B session_id', async () => {
    state.ownedLookup = null
    const res = await GET(
      new NextRequest(`http://localhost/admin-api/ai-chats?session_id=${SESSION_B}`),
    )
    expect(res.status).toBe(404)
    expect(getOwnedAiSession).toHaveBeenCalledWith(
      expect.anything(),
      SESSION_B,
      CO_A,
    )
  })

  it('returns 404 when deleting company B session_id', async () => {
    state.ownedLookup = null
    const res = await DELETE(
      new NextRequest(`http://localhost/admin-api/ai-chats?session_id=${SESSION_B}`, {
        method: 'DELETE',
      }),
    )
    expect(res.status).toBe(404)
    expect(state.lastDeleteEq).toEqual([])
  })

  it('deletes only when session belongs to caller company', async () => {
    state.ownedLookup = {
      id: SESSION_B,
      client_id: 'client_x',
      company_id: CO_A,
    }
    // Even if id looks like B's, ownership mock says it belongs to A
    const res = await DELETE(
      new NextRequest(`http://localhost/admin-api/ai-chats?session_id=${SESSION_B}`, {
        method: 'DELETE',
      }),
    )
    expect(res.status).toBe(200)
    expect(state.lastDeleteEq).toEqual(
      expect.arrayContaining([
        { col: 'id', val: SESSION_B },
        { col: 'company_id', val: CO_A },
      ]),
    )
  })

  it('never trusts company B id from query for listing scope', async () => {
    state.callerCompanyId = CO_A
    await GET(new NextRequest(`http://localhost/admin-api/ai-chats?company_id=${CO_B}`))
    expect(state.lastSessionsEq.find((e) => e.col === 'company_id')?.val).toBe(CO_A)
    expect(state.lastSessionsEq.find((e) => e.col === 'company_id')?.val).not.toBe(CO_B)
  })
})
