import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from './auth-async'

interface CompanyAuthSuccess {
  ok: true
  companyId: string
  authHeader: string | null
}

interface CompanyAuthFailure {
  ok: false
  error: NextResponse
}

export type CompanyAuthResult = CompanyAuthSuccess | CompanyAuthFailure

/**
 * Shared guard for all admin API routes that proxy to the Profiles API.
 * Verifies JWT and resolves company_id in one call.
 */
export async function requireCompanyAuth(req: NextRequest): Promise<CompanyAuthResult> {
  const authCheck = await requireAuthAsync(req)

  if (!authCheck.authorized) {
    return { ok: false, error: authCheck.error }
  }

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Company ID not found' }, { status: 400 }),
    }
  }

  return {
    ok: true,
    companyId,
    authHeader: req.headers.get('authorization'),
  }
}
