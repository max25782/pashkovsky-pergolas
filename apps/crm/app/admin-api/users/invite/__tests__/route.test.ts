process.env.SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'

const mockListUsers = jest.fn()
const mockCreateUser = jest.fn()
const mockMemberInsert = jest.fn()
const mockProfileUpsert = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { admin: { listUsers: mockListUsers, createUser: mockCreateUser } },
    from: (table: string) => {
      if (table === 'users') {
        return { upsert: (...args: unknown[]) => { mockProfileUpsert(...args); return Promise.resolve({ error: null }) } }
      }
      if (table === 'company_members') {
        return {
          insert: (row: unknown) => {
            mockMemberInsert(row)
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'member-1' }, error: null }) }) }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  })),
}))

jest.mock('@/lib/middleware/auth-async', () => ({ requireAuthAsync: jest.fn() }))
jest.mock('@/lib/middleware/auth', () => ({ requirePermissionAsync: jest.fn() }))
jest.mock('@/lib/audit/logger', () => ({ logResourceEvent: jest.fn() }))

import { NextRequest } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requirePermissionAsync } from '@/lib/middleware/auth'
import { POST } from '@/app/admin-api/users/invite/route'

const requireAuth = requireAuthAsync as jest.MockedFunction<typeof requireAuthAsync>
const requirePermission = requirePermissionAsync as jest.MockedFunction<typeof requirePermissionAsync>

const COMPANY_A = 'company-a'
const COMPANY_B = 'company-b'

function inviteRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/admin-api/users/invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

async function invite(body: Record<string, unknown>) {
  const res = await POST(inviteRequest(body))
  if (!res) throw new Error('route returned no response')
  return res
}

function callerIs(companyId: string | undefined) {
  requireAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'caller', email: 'caller@example.test' },
    context: { userId: 'caller', email: 'caller@example.test', companyId },
  })
  requirePermission.mockResolvedValue({ authorized: true, role: 'admin', companyId })
}

function authUsers(count: number, extra: Array<{ id: string; email: string }> = []) {
  const filler = Array.from({ length: count }, (_, i) => ({ id: `filler-${i}`, email: `filler${i}@example.test` }))
  return [...filler, ...extra]
}

describe('POST /admin-api/users/invite', () => {
  beforeEach(() => {
    mockListUsers.mockReset()
    mockCreateUser.mockReset()
    mockMemberInsert.mockReset()
    mockProfileUpsert.mockReset()
    mockListUsers.mockResolvedValue({ data: { users: [] }, error: null })
    mockCreateUser.mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null })
  })

  it('403 when the caller has no company in the session (was fail-open)', async () => {
    callerIs(undefined)
    const res = await invite({ email: 'new@example.test', companyId: COMPANY_A })
    expect(res.status).toBe(403)
    expect(mockListUsers).not.toHaveBeenCalled()
    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(mockMemberInsert).not.toHaveBeenCalled()
  })

  it('403 when the target company differs from the session company', async () => {
    callerIs(COMPANY_A)
    const res = await invite({ email: 'new@example.test', companyId: COMPANY_B })
    expect(res.status).toBe(403)
    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(mockMemberInsert).not.toHaveBeenCalled()
  })

  it('409 and no membership when the email already exists (case-insensitive)', async () => {
    callerIs(COMPANY_A)
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: 'victim', email: 'Victim@Example.test' }] },
      error: null,
    })
    const res = await invite({ email: ' victim@example.TEST ', companyId: COMPANY_A })
    expect(res.status).toBe(409)
    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(mockProfileUpsert).not.toHaveBeenCalled()
    expect(mockMemberInsert).not.toHaveBeenCalled()
  })

  it('finds an existing email beyond the first listUsers page (409)', async () => {
    callerIs(COMPANY_A)
    mockListUsers
      .mockResolvedValueOnce({ data: { users: authUsers(1000) }, error: null })
      .mockResolvedValueOnce({
        data: { users: authUsers(5, [{ id: 'deep', email: 'deep@example.test' }]) },
        error: null,
      })
    const res = await invite({ email: 'deep@example.test', companyId: COMPANY_A })
    expect(res.status).toBe(409)
    expect(mockListUsers).toHaveBeenCalledTimes(2)
    expect(mockListUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 1000 })
    expect(mockListUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 })
    expect(mockMemberInsert).not.toHaveBeenCalled()
  })

  it('fails closed (500, nothing created) when listUsers errors', async () => {
    callerIs(COMPANY_A)
    mockListUsers.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const res = await invite({ email: 'new@example.test', companyId: COMPANY_A })
    expect(res.status).toBe(500)
    expect(mockCreateUser).not.toHaveBeenCalled()
    expect(mockMemberInsert).not.toHaveBeenCalled()
  })

  it('409 when createUser reports the email already exists (race)', async () => {
    callerIs(COMPANY_A)
    mockCreateUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_exists', message: 'exists' } })
    const res = await invite({ email: 'race@example.test', companyId: COMPANY_A })
    expect(res.status).toBe(409)
    expect(mockMemberInsert).not.toHaveBeenCalled()
  })

  it('400 for the owner role', async () => {
    callerIs(COMPANY_A)
    const res = await invite({ email: 'new@example.test', companyId: COMPANY_A, role: 'owner' })
    expect(res.status).toBe(400)
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it('201: creates a brand-new user and adds it to the session company only', async () => {
    callerIs(COMPANY_A)
    const res = await invite({ email: 'New@Example.test', companyId: COMPANY_A, role: 'viewer' })
    expect(res.status).toBe(201)
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.test', email_confirm: true }),
    )
    expect(mockMemberInsert).toHaveBeenCalledTimes(1)
    expect(mockMemberInsert).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: COMPANY_A, user_id: 'new-user', role: 'viewer' }),
    )
  })
})
