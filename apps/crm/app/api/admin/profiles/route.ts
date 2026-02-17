/**
 * Profiles API Route
 * Proxies requests to NestJS Profiles API
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

/**
 * GET /api/admin/profiles
 * List all profiles for the company
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  try {
    // Get JWT token from request
    const authHeader = req.headers.get('authorization')
    
    // Forward request to NestJS API
    const response = await fetch(`${PROFILES_API_URL}/profiles?company_id=${companyId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let error: any
      try {
        error = JSON.parse(errorText)
      } catch {
        error = { message: errorText || 'Failed to fetch profiles' }
      }
      
      console.error('[Profiles API Proxy] NestJS error:', {
        status: response.status,
        error: error.message || error,
        url: `${PROFILES_API_URL}/profiles?company_id=${companyId}`
      })
      
      return NextResponse.json(
        { error: error.message || error.error || 'Failed to fetch profiles' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Profiles API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/profiles
 * Create a new profile
 */
export async function POST(req: NextRequest) {
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
    const response = await fetch(`${PROFILES_API_URL}/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create profile' }))
      return NextResponse.json(
        { error: error.message || 'Failed to create profile' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Profiles API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
