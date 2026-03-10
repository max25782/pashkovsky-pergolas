import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAuth } from '@/lib/middleware/require-company-auth'
import { profilesApi, handleProxyError } from '@/lib/profiles-api/client'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const auth = await requireCompanyAuth(req)
  if (!auth.ok) return auth.error

  try {
    const body: unknown = await req.json()
    const result = await profilesApi.orders.patchItem(
      params.id,
      params.itemId,
      auth.companyId,
      body,
      auth.authHeader,
    )
    if (!result.ok) {
      const msg = (result.data as { message?: string })?.message || 'Failed to update order item'
      return NextResponse.json({ error: msg }, { status: result.status })
    }
    return NextResponse.json(result.data)
  } catch (error) {
    return handleProxyError(error, 'PATCH /orders/[id]/items/[itemId]')
  }
}
