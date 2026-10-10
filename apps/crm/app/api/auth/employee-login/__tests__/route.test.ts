const mockCreateClient = jest.fn()
const mockLoginByEmail = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

jest.mock('@/lib/auth/employee-email-login', () => ({
  loginApprovedEmployeeByEmail: (...args: unknown[]) => mockLoginByEmail(...args),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/employee-login/route'
import { EMPLOYEE_LOGIN_DISABLED_MESSAGE } from '@/lib/auth/employee-login-disabled'

function loginRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/employee-login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/employee-login (disabled)', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
    mockCreateClient.mockClear()
    mockLoginByEmail.mockClear()
  })

  it('returns 410 Gone with the fixed message', async () => {
    const res = await POST()
    expect(res.status).toBe(410)
    await expect(res.json()).resolves.toEqual({ error: EMPLOYEE_LOGIN_DISABLED_MESSAGE })
  })

  it('does not touch Supabase or the email-login implementation', async () => {
    await POST()
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockLoginByEmail).not.toHaveBeenCalled()
  })

  it('ignores the request body (valid, empty and malformed bodies all get 410)', async () => {
    const route = POST as unknown as (req: NextRequest) => Promise<Response>
    const bodies: unknown[] = [{ email: 'someone@example.com' }, {}, 'not-json']
    for (const body of bodies) {
      const res = await route(loginRequest(body))
      expect(res.status).toBe(410)
    }
    expect(mockLoginByEmail).not.toHaveBeenCalled()
  })

  it('message mentions the supported alternatives', () => {
    expect(EMPLOYEE_LOGIN_DISABLED_MESSAGE).toMatch(/password/i)
    expect(EMPLOYEE_LOGIN_DISABLED_MESSAGE).toMatch(/Google/)
  })
})
