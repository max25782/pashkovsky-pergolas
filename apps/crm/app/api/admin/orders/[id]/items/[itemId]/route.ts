/**
 * Order Items API Route
 * Proxies requests to NestJS Profiles API
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/admin/orders/[id]/items/[itemId]
 * Update an order item price
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    const { id, itemId } = params
    const body = await req.json()
    const authHeader = req.headers.get('authorization')

    // Forward request to NestJS API
    const response = await fetch(`${PROFILES_API_URL}/orders/${id}/items/${itemId}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update order item' }))
      return NextResponse.json(
        { error: error.message || 'Failed to update order item' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Orders API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
