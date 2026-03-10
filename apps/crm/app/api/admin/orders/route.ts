import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAuth } from '@/lib/middleware/require-company-auth'
import { profilesApi, handleProxyError } from '@/lib/profiles-api/client'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAuth(req)
  if (!auth.ok) return auth.error

  try {
    const result = await profilesApi.orders.list(auth.companyId, auth.authHeader)
    if (!result.ok) {
      const msg = (result.data as { message?: string })?.message || 'Failed to fetch orders'
      return NextResponse.json({ error: msg }, { status: result.status })
    }
    return NextResponse.json(result.data)
  } catch (error) {
    return handleProxyError(error, 'GET /orders')
  }
}
