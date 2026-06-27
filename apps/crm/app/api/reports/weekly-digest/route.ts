/**
 * Get weekly digests endpoint
 * 
 * GET /api/reports/weekly-digest
 * GET /api/reports/weekly-digest?id=...
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWeeklyDigests, getWeeklyDigest } from '@/lib/analytics/weeklyDigest'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // 1. Check auth
    const authCheck = await requireAuthAsync(req)
    if (!authCheck.authorized) return authCheck.error

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const companyId = authCheck.context?.companyId || searchParams.get('companyId') || undefined
    const limit = parseInt(searchParams.get('limit') || '20')

    // 2. Get single digest or list
    if (id) {
      const digest = await getWeeklyDigest(id)
      if (!digest) {
        return NextResponse.json(
          { error: 'Digest not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ digest })
    } else {
      const digests = await getWeeklyDigests(companyId, limit)
      return NextResponse.json({ digests })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Weekly Digest GET] Error:', {
      error: msg?.substring(0, 500), // Limit log size
    })

    return NextResponse.json(
      { error: 'Failed to fetch digests' },
      { status: 500 }
    )
  }
}

