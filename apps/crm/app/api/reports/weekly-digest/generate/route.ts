/**
 * Manual weekly digest generation endpoint
 * 
 * POST /api/reports/weekly-digest/generate
 * 
 * Only accessible to admin users
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyDigest } from '@/lib/analytics/weeklyDigest'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // 1. Check auth
    const authCheck = await requireAuthAsync(req)
    if (!authCheck.authorized) return authCheck.error

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

    // Use company from auth context if not provided in body
    const companyId = body.companyId || authCheck.context?.companyId
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // 3. Generate digest
    const digest = await generateWeeklyDigest(companyId)

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

