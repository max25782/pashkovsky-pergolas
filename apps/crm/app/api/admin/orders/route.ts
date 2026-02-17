/**
 * Orders API Route
 * Proxies requests to NestJS Profiles API
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const PROFILES_API_URL = process.env.PROFILES_API_URL || 'http://localhost:3002'

/**
 * GET /api/admin/orders
 * List all orders for the company
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
    const response = await fetch(`${PROFILES_API_URL}/orders?company_id=${companyId}`, {
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
        error = { message: errorText || 'Failed to fetch orders' }
      }
      
      console.error('[Orders API Proxy] NestJS error:', {
        status: response.status,
        error: error.message || error,
        url: `${PROFILES_API_URL}/orders?company_id=${companyId}`
      })
      
      return NextResponse.json(
        { error: error.message || error.error || 'Failed to fetch orders' },
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
