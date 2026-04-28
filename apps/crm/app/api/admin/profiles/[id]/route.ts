/**
 * Profiles API Route - Individual Profile Operations
 * Proxies requests to NestJS Profiles API
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

/**
 * PATCH /api/admin/profiles/[id]
 * Update a profile
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const authHeader = req.headers.get('authorization')

    // Forward request to NestJS API
    const response = await fetch(`${PROFILES_API_URL}/profiles/${params.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Id': companyId,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update profile' }))
      return NextResponse.json(
        { error: error.message || 'Failed to update profile' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('[Profiles API] Error:', error)
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/profiles/[id]
 * Delete (deactivate) a profile
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    const authHeader = req.headers.get('authorization')

    // Forward request to NestJS API
    const response = await fetch(`${PROFILES_API_URL}/profiles/${params.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Id': companyId,
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete profile' }))
      return NextResponse.json(
        { error: error.message || 'Failed to delete profile' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('[Profiles API] Error:', error)
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) || 'Internal server error' },
      { status: 500 }
    )
  }
}
