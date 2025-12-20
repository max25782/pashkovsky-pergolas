/**
 * Manual weekly digest generation endpoint
 * 
 * POST /api/reports/weekly-digest/generate
 * 
 * Only accessible to admin users
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyDigest } from '@/lib/analytics/weeklyDigest'

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic'

function auth(req: NextRequest): boolean {
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

export async function POST(req: NextRequest) {
  try {
    // 1. Check auth
    if (!auth(req)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse optional companyId from body
    let body: { companyId?: string } = {}
    try {
      const bodyText = await req.text()
      if (bodyText) {
        body = JSON.parse(bodyText)
      }
    } catch {
      // Empty body is OK
    }

    // 3. Generate digest
    const digest = await generateWeeklyDigest(body.companyId)

    return NextResponse.json({
      success: true,
      digest: {
        id: digest.id,
        companyId: digest.companyId,
        periodFrom: digest.periodFrom,
        periodTo: digest.periodTo,
        status: digest.status,
      },
    })
  } catch (error: any) {
    console.error('[Weekly Digest Generate] Error:', {
      error: error.message?.substring(0, 500), // Limit log size
    })

    return NextResponse.json(
      { error: 'Failed to generate digest', details: error.message },
      { status: 500 }
    )
  }
}

