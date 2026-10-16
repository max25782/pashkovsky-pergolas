const mockFindAuthUser = jest.fn()
const mockGenerateLink = jest.fn()
const mockVerifyOtp = jest.fn()
const mockSetAll = jest.fn()

type StoredMember = { user_id: string; company_id: string; role: string }

let storedMembers: StoredMember[] = []
let memberQueryError: { message: string } | null = null
let lastMemberQuery: { userId?: string; limit?: number } = {}

function membershipBuilder() {
  const state: { userId?: string; limit?: number } = {}
  const finish = () => {
    lastMemberQuery = { userId: state.userId, limit: state.limit }
    if (memberQueryError) return { data: null, error: memberQueryError }
    let rows = storedMembers.filter((r) => !state.userId || r.user_id === state.userId)
    if (state.limit !== undefined) rows = rows.slice(0, state.limit)
    return { data: rows, error: null }
  }
  const q: {
    select: () => typeof q
    eq: (col: string, val: string) => typeof q
    limit: (n: number) => typeof q
    maybeSingle: () => Promise<{ data: StoredMember | null; error: unknown }>
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
  } = {
    select: () => q,
    eq: (col, val) => {
      if (col === 'user_id') state.userId = val
      return q
    },
    limit: (n) => {
      state.limit = n
      return q
    },
    maybeSingle: async () => {
      const result = finish()
      if (result.error) return { data: null, error: result.error }
      return { data: result.data[0] ?? null, error: null }
    },
    then: (resolve, reject) => Promise.resolve(finish()).then(resolve, reject),
  }
  return q
}

jest.mock('@/lib/auth/find-auth-user-by-email', () => ({
  findAuthUserByEmail: (...args: unknown[]) => mockFindAuthUser(...args),
  AuthUserLookupError: class AuthUserLookupError extends Error {},
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'company_members') return membershipBuilder()
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }
    },
    auth: {
      admin: {
        generateLink: (...args: unknown[]) => mockGenerateLink(...args),
      },
    },
  }),
}))

jest.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: (cookies: { name: string; value: string; options: object }[]) => void } },
  ) => {
    mockSetAll(opts)
    opts.cookies.setAll([{ name: 'sb-access-token', value: 'session-token', options: { path: '/' } }])
    return {
      auth: {
        verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      },
    }
  },
}))

import { NextRequest } from 'next/server'
import {
  EMPLOYEE_LOGIN_DENIED_ERROR,
  EMPLOYEE_LOGIN_DENIED_STATUS,
  EMPLOYEE_LOGIN_EMAIL_LIMIT_PER_HOUR,
  EMPLOYEE_LOGIN_IP_LIMIT_PER_MINUTE,
  EMPLOYEE_LOGIN_RATE_LIMIT_STATUS,
  checkEmployeeLoginRateLimit,
  decideEmployeeMembership,
  loginApprovedEmployeeByEmail,
  normalizeEmployeeEmail,
  resetEmployeeLoginRateLimitForTests,
} from '@/lib/auth/employee-email-login'

const SALES_ID = '11111111-1111-1111-1111-111111111111'
const FOREIGN_CO = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const OWN_CO = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

function loginRequest(email: string, ip = '203.0.113.10'): NextRequest {
  return new NextRequest('http://127.0.0.1/api/auth/employee-login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ email }),
  })
}

async function deniedShape(res: Response) {
  return { status: res.status, body: await res.json() }
}

describe('normalizeEmployeeEmail', () => {
  it('trims spaces and lowercases', () => {
    expect(normalizeEmployeeEmail('  Sales@Co.COM  ')).toBe('sales@co.com')
  })
})

describe('decideEmployeeMembership', () => {
  it('allows a single salesperson membership and returns that company', () => {
    const decision = decideEmployeeMembership([
      { user_id: SALES_ID, company_id: OWN_CO, role: 'salesperson' },
    ])
    expect(decision).toEqual({
      ok: true,
      user_id: SALES_ID,
      company_id: OWN_CO,
      role: 'salesperson',
    })
  })

  it.each(['worker', 'viewer'] as const)('allows a single %s membership', (role) => {
    const decision = decideEmployeeMembership([
      { user_id: SALES_ID, company_id: OWN_CO, role },
    ])
    expect(decision).toMatchObject({ ok: true, company_id: OWN_CO, role })
  })

  it.each(['owner', 'admin', 'manager', 'superadmin', ''] as const)(
    'refuses a single %s membership (mutation: dropping the role check accepts this)',
    (role) => {
      expect(decideEmployeeMembership([
        { user_id: SALES_ID, company_id: OWN_CO, role },
      ])).toEqual({ ok: false, reason: 'forbidden_role' })
    },
  )

  it('refuses zero memberships', () => {
    expect(decideEmployeeMembership([])).toEqual({ ok: false, reason: 'no_memberships' })
  })

  it('refuses two memberships even when both are salesperson (mutation: dropping the count check accepts this)', () => {
    expect(decideEmployeeMembership([
      { user_id: SALES_ID, company_id: FOREIGN_CO, role: 'salesperson' },
      { user_id: SALES_ID, company_id: OWN_CO, role: 'salesperson' },
    ])).toEqual({ ok: false, reason: 'multiple_memberships' })
  })

  it('refuses salesperson in a foreign company plus owner in their own (mutation: limit(1) would pick the first row)', () => {
    expect(decideEmployeeMembership([
      { user_id: SALES_ID, company_id: FOREIGN_CO, role: 'salesperson' },
      { user_id: SALES_ID, company_id: OWN_CO, role: 'owner' },
    ])).toEqual({ ok: false, reason: 'multiple_memberships' })
  })
})

describe('loginApprovedEmployeeByEmail', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test'
    storedMembers = []
    memberQueryError = null
    lastMemberQuery = {}
    resetEmployeeLoginRateLimitForTests()
    mockFindAuthUser.mockReset()
    mockGenerateLink.mockReset()
    mockVerifyOtp.mockReset()
    mockSetAll.mockReset()
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: 'hashed-otp' } },
      error: null,
    })
    mockVerifyOtp.mockResolvedValue({ error: null })
  })

  it('creates a session in the company of the single allowed membership', async () => {
    mockFindAuthUser.mockResolvedValue({ id: SALES_ID, email: 'sales@co.com' })
    storedMembers = [{ user_id: SALES_ID, company_id: OWN_CO, role: 'salesperson' }]

    const res = await loginApprovedEmployeeByEmail('  Sales@Co.COM  ', loginRequest('  Sales@Co.COM  '))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      redirectTo: '/app',
      companyId: OWN_CO,
      role: 'salesperson',
    })
    expect(res.cookies.get('sb-access-token')?.value).toBe('session-token')
    expect(mockFindAuthUser).toHaveBeenCalledWith(expect.anything(), 'sales@co.com')
    expect(lastMemberQuery.limit).toBeUndefined()
    expect(mockGenerateLink).toHaveBeenCalledTimes(1)
    expect(mockVerifyOtp).toHaveBeenCalledWith({ token_hash: 'hashed-otp', type: 'magiclink' })
  })

  it.each(['owner', 'admin', 'manager', 'not-a-role'])(
    'denies %s with the uniform body and does not mint a session',
    async (role) => {
      mockFindAuthUser.mockResolvedValue({ id: SALES_ID, email: 'boss@co.com' })
      storedMembers = [{ user_id: SALES_ID, company_id: OWN_CO, role }]

      const res = await loginApprovedEmployeeByEmail('boss@co.com', loginRequest('boss@co.com'))
      expect(await deniedShape(res)).toEqual({
        status: EMPLOYEE_LOGIN_DENIED_STATUS,
        body: { error: EMPLOYEE_LOGIN_DENIED_ERROR },
      })
      expect(mockGenerateLink).not.toHaveBeenCalled()
    },
  )

  it('denies two memberships and does not mint a session', async () => {
    mockFindAuthUser.mockResolvedValue({ id: SALES_ID, email: 'sales@co.com' })
    storedMembers = [
      { user_id: SALES_ID, company_id: FOREIGN_CO, role: 'salesperson' },
      { user_id: SALES_ID, company_id: OWN_CO, role: 'salesperson' },
    ]

    const res = await loginApprovedEmployeeByEmail('sales@co.com', loginRequest('sales@co.com'))
    expect(await deniedShape(res)).toEqual({
      status: EMPLOYEE_LOGIN_DENIED_STATUS,
      body: { error: EMPLOYEE_LOGIN_DENIED_ERROR },
    })
    expect(lastMemberQuery.limit).toBeUndefined()
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it('denies zero memberships', async () => {
    mockFindAuthUser.mockResolvedValue({ id: SALES_ID, email: 'sales@co.com' })
    storedMembers = []

    const res = await loginApprovedEmployeeByEmail('sales@co.com', loginRequest('sales@co.com'))
    expect(await deniedShape(res)).toEqual({
      status: EMPLOYEE_LOGIN_DENIED_STATUS,
      body: { error: EMPLOYEE_LOGIN_DENIED_ERROR },
    })
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it('denies salesperson-in-foreign plus owner-in-own even if a limit(1) would return the salesperson row', async () => {
    mockFindAuthUser.mockResolvedValue({ id: SALES_ID, email: 'sales@co.com' })
    storedMembers = [
      { user_id: SALES_ID, company_id: FOREIGN_CO, role: 'salesperson' },
      { user_id: SALES_ID, company_id: OWN_CO, role: 'owner' },
    ]

    const res = await loginApprovedEmployeeByEmail('sales@co.com', loginRequest('sales@co.com'))
    expect(await deniedShape(res)).toEqual({
      status: EMPLOYEE_LOGIN_DENIED_STATUS,
      body: { error: EMPLOYEE_LOGIN_DENIED_ERROR },
    })
    expect(lastMemberQuery.limit).toBeUndefined()
    expect(mockGenerateLink).not.toHaveBeenCalled()
  })

  it('returns the same status and body for a missing email and for a forbidden role', async () => {
    mockFindAuthUser.mockResolvedValueOnce(null)
    const missing = await deniedShape(
      await loginApprovedEmployeeByEmail('nobody@co.com', loginRequest('nobody@co.com', '203.0.113.20')),
    )

    mockFindAuthUser.mockResolvedValueOnce({ id: SALES_ID, email: 'owner@co.com' })
    storedMembers = [{ user_id: SALES_ID, company_id: OWN_CO, role: 'owner' }]
    const forbidden = await deniedShape(
      await loginApprovedEmployeeByEmail('owner@co.com', loginRequest('owner@co.com', '203.0.113.21')),
    )

    expect(missing).toEqual(forbidden)
    expect(missing).toEqual({
      status: EMPLOYEE_LOGIN_DENIED_STATUS,
      body: { error: EMPLOYEE_LOGIN_DENIED_ERROR },
    })
  })

  it('looks up the normalized email so case and spaces do not create a second identity', async () => {
    mockFindAuthUser.mockResolvedValue({ id: SALES_ID, email: 'sales@co.com' })
    storedMembers = [{ user_id: SALES_ID, company_id: OWN_CO, role: 'worker' }]

    await loginApprovedEmployeeByEmail('\tSALES@co.com ', loginRequest('\tSALES@co.com '))
    expect(mockFindAuthUser).toHaveBeenCalledWith(expect.anything(), 'sales@co.com')
  })

  it('rate-limits the 6th attempt from the same IP within a minute', async () => {
    mockFindAuthUser.mockResolvedValue(null)
    const ip = '198.51.100.7'
    for (let i = 0; i < EMPLOYEE_LOGIN_IP_LIMIT_PER_MINUTE; i += 1) {
      const res = await loginApprovedEmployeeByEmail(`u${i}@co.com`, loginRequest(`u${i}@co.com`, ip))
      expect(res.status).toBe(EMPLOYEE_LOGIN_DENIED_STATUS)
    }
    const blocked = await loginApprovedEmployeeByEmail('last@co.com', loginRequest('last@co.com', ip))
    expect(blocked.status).toBe(EMPLOYEE_LOGIN_RATE_LIMIT_STATUS)
    expect(await blocked.json()).toEqual({ error: EMPLOYEE_LOGIN_DENIED_ERROR })
    expect(mockFindAuthUser).toHaveBeenCalledTimes(EMPLOYEE_LOGIN_IP_LIMIT_PER_MINUTE)
  })

  it('rate-limits the 21st attempt for the same email in an hour (across IPs)', async () => {
    mockFindAuthUser.mockResolvedValue(null)
    const email = 'repeat@co.com'
    for (let i = 0; i < EMPLOYEE_LOGIN_EMAIL_LIMIT_PER_HOUR; i += 1) {
      const res = await loginApprovedEmployeeByEmail(email, loginRequest(email, `198.51.100.${i}`))
      expect(res.status).toBe(EMPLOYEE_LOGIN_DENIED_STATUS)
    }
    const blocked = await loginApprovedEmployeeByEmail(
      email,
      loginRequest(email, '198.51.100.250'),
    )
    expect(blocked.status).toBe(EMPLOYEE_LOGIN_RATE_LIMIT_STATUS)
  })
})

describe('checkEmployeeLoginRateLimit', () => {
  beforeEach(() => {
    resetEmployeeLoginRateLimitForTests()
  })

  it('allows the first hit and then enforces the IP window', () => {
    const now = 1_700_000_000_000
    expect(checkEmployeeLoginRateLimit('1.1.1.1', 'a@b.c', now)).toBe(true)
    expect(checkEmployeeLoginRateLimit('1.1.1.1', 'b@b.c', now + 10)).toBe(true)
    expect(checkEmployeeLoginRateLimit('1.1.1.1', 'c@b.c', now + 20)).toBe(true)
    expect(checkEmployeeLoginRateLimit('1.1.1.1', 'd@b.c', now + 30)).toBe(true)
    expect(checkEmployeeLoginRateLimit('1.1.1.1', 'e@b.c', now + 40)).toBe(true)
    expect(checkEmployeeLoginRateLimit('1.1.1.1', 'f@b.c', now + 50)).toBe(false)
    expect(checkEmployeeLoginRateLimit('1.1.1.1', 'g@b.c', now + 60_000)).toBe(true)
  })
})
