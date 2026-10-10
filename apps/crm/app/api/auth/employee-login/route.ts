import { NextResponse } from 'next/server'
import { EMPLOYEE_LOGIN_DISABLED_MESSAGE } from '@/lib/auth/employee-login-disabled'

export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/employee-login — DISABLED (410 Gone).
 *
 * The endpoint used to mint a session from an email address alone. It now
 * answers with a fixed message and touches neither the database nor Supabase
 * Auth. The request body is intentionally not read.
 */
export async function POST() {
  return NextResponse.json(
    { error: EMPLOYEE_LOGIN_DISABLED_MESSAGE },
    { status: 410 },
  )
}
