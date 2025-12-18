/**
 * Get weekly digests endpoint
 * 
 * GET /api/reports/weekly-digest
 * GET /api/reports/weekly-digest?id=...
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWeeklyDigests, getWeeklyDigest } from '@/lib/analytics/weeklyDigest'

function auth(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

export async function GET(req: NextRequest) {
  try {
    // 1. Check auth
    if (!auth(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const companyId = searchParams.get('companyId') || undefined
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
  } catch (error: any) {
    console.error('[Weekly Digest GET] Error:', {
      error: error.message?.substring(0, 500), // Limit log size
    })

    return NextResponse.json(
      { error: 'Failed to fetch digests', details: error.message },
      { status: 500 }
    )
  }
}

