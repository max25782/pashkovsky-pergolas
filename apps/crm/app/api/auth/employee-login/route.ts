import { NextRequest, NextResponse } from 'next/server'
import {
  EMPLOYEE_LOGIN_DENIED_ERROR,
  EMPLOYEE_LOGIN_DENIED_STATUS,
  loginApprovedEmployeeByEmail,
} from '@/lib/auth/employee-email-login'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/employee-login
 * Email-only login when the caller has exactly one membership whose role is
 * salesperson, worker, or viewer. Every other case returns the same 403.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: unknown } | null
    const email = typeof body?.email === 'string' ? body.email : ''
    return loginApprovedEmployeeByEmail(email, req)
  } catch {
    return NextResponse.json(
      { error: EMPLOYEE_LOGIN_DENIED_ERROR },
      { status: EMPLOYEE_LOGIN_DENIED_STATUS },
    )
  }
}
