/**
 * Orders API Route - Individual Order Operations
 * Proxies requests to NestJS Profiles API
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/admin/orders/[id]
 * Fetch a single order by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    const { id } = params

    const response = await fetch(
      `${PROFILES_API_URL}/orders/${id}?company_id=${companyId}`,
      { signal: AbortSignal.timeout(30000) }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Order not found' }))
      return NextResponse.json(
        { error: error.message || 'Order not found' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Orders API GET] Error:', error)
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return NextResponse.json(
      { error: isTimeout ? 'Request to Profiles API timed out' : error.message || 'Internal server error' },
      { status: isTimeout ? 504 : 500 }
    )
  }
}

/**
 * PATCH /api/admin/orders/[id]
 * Update an order
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    const { id } = params
    const body = await req.json()
    const authHeader = req.headers.get('authorization')

    const response = await fetch(`${PROFILES_API_URL}/orders/${id}?company_id=${companyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update order' }))
      return NextResponse.json(
        { error: error.message || 'Failed to update order' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Orders API PATCH] Error:', error)
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return NextResponse.json(
      { error: isTimeout ? 'Request to Profiles API timed out' : error.message || 'Internal server error' },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
