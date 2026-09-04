import { NextRequest, NextResponse } from 'next/server'
import { loginApprovedEmployeeByEmail } from '@/lib/auth/employee-email-login'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/employee-login
 * Email-only login for admin-approved team members — no password, no email sent.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string }
    const email = body.email?.trim()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    return loginApprovedEmployeeByEmail(email, req)
  } catch (e) {
    console.error('[employee-login]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
