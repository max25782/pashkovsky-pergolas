const mockLoginByEmail = jest.fn()

jest.mock('@/lib/auth/employee-email-login', () => {
  const actual = jest.requireActual('@/lib/auth/employee-email-login') as typeof import('@/lib/auth/employee-email-login')
  return {
    ...actual,
    loginApprovedEmployeeByEmail: (...args: unknown[]) => mockLoginByEmail(...args),
  }
})

import { NextRequest, NextResponse } from 'next/server'
import { POST } from '@/app/api/auth/employee-login/route'
import {
  EMPLOYEE_LOGIN_DENIED_ERROR,
  EMPLOYEE_LOGIN_DENIED_STATUS,
} from '@/lib/auth/employee-email-login'

function loginRequest(body: unknown) {
  return new NextRequest('http://127.0.0.1/api/auth/employee-login', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/auth/employee-login', () => {
  beforeEach(() => {
    mockLoginByEmail.mockReset()
    mockLoginByEmail.mockImplementation(async () =>
      NextResponse.json({ error: EMPLOYEE_LOGIN_DENIED_ERROR }, { status: EMPLOYEE_LOGIN_DENIED_STATUS }),
    )
  })

  it('forwards the email to the membership-rule login', async () => {
    mockLoginByEmail.mockResolvedValue(
      NextResponse.json({ ok: true, redirectTo: '/app', companyId: 'co-1', role: 'salesperson' }),
    )
    const req = loginRequest({ email: 'sales@co.com' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockLoginByEmail).toHaveBeenCalledWith('sales@co.com', req)
  })

  it('uses the same denial for a missing body and for an empty email', async () => {
    const missing = await POST(loginRequest('not-json'))
    const empty = await POST(loginRequest({}))
    expect(mockLoginByEmail.mock.calls[0][0]).toBe('')
    expect(mockLoginByEmail.mock.calls[1][0]).toBe('')
    expect(missing.status).toBe(EMPLOYEE_LOGIN_DENIED_STATUS)
    expect(empty.status).toBe(EMPLOYEE_LOGIN_DENIED_STATUS)
    expect(await missing.json()).toEqual(await empty.json())
  })
})
