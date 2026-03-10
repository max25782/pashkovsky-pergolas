import { NextRequest, NextResponse } from 'next/server'
import { requireCompanyAuth } from '@/lib/middleware/require-company-auth'
import { profilesApi, handleProxyError } from '@/lib/profiles-api/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireCompanyAuth(req)
  if (!auth.ok) return auth.error

  try {
    const result = await profilesApi.orders.get(params.id, auth.companyId, auth.authHeader)
    if (!result.ok) {
      const msg = (result.data as { message?: string })?.message || 'Order not found'
      return NextResponse.json({ error: msg }, { status: result.status })
    }
    return NextResponse.json(result.data)
  } catch (error) {
    return handleProxyError(error, 'GET /orders/[id]')
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireCompanyAuth(req)
  if (!auth.ok) return auth.error

  try {
    const body: unknown = await req.json()
    const result = await profilesApi.orders.patch(params.id, auth.companyId, body, auth.authHeader)
    if (!result.ok) {
      const msg = (result.data as { message?: string })?.message || 'Failed to update order'
      return NextResponse.json({ error: msg }, { status: result.status })
    }
    return NextResponse.json(result.data)
  } catch (error) {
    return handleProxyError(error, 'PATCH /orders/[id]')
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireCompanyAuth(req)
  if (!auth.ok) return auth.error

  try {
    const result = await profilesApi.orders.delete(params.id, auth.companyId, auth.authHeader)
    if (!result.ok) {
      const msg = (result.data as { message?: string })?.message || 'Failed to delete order'
      return NextResponse.json({ error: msg }, { status: result.status })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return handleProxyError(error, 'DELETE /orders/[id]')
  }
}
