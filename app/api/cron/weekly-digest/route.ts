/**
 * Cron endpoint for weekly digest generation
 * 
 * POST /api/cron/weekly-digest?token=...
 * 
 * Called by external scheduler (Vercel Cron) every Monday at 09:00 Asia/Jerusalem
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyDigest } from '@/lib/analytics/weeklyDigest'

const CRON_SECRET_TOKEN = process.env.CRON_SECRET_TOKEN || process.env.WEEKLY_DIGEST_CRON_TOKEN

export async function POST(req: NextRequest) {
  try {
    // 1. Check auth token
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!CRON_SECRET_TOKEN) {
      console.error('[Weekly Digest Cron] CRON_SECRET_TOKEN not configured')
      return NextResponse.json(
        { error: 'Cron endpoint not configured' },
        { status: 500 }
      )
    }

    if (token !== CRON_SECRET_TOKEN) {
      console.warn('[Weekly Digest Cron] Invalid token attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Rate limit check (simple in-memory, can be improved)
    const lastRunKey = 'weekly_digest_last_run'
    const lastRun = (global as any)[lastRunKey]
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    if (lastRun && (now - lastRun) < oneHour) {
      return NextResponse.json(
        { error: 'Rate limit: Already ran within last hour' },
        { status: 429 }
      )
    }

    (global as any)[lastRunKey] = now

    // 3. Generate digest for all companies (or default company)
    // For now, generate for null companyId (default company)
    // In future, can iterate over companies if company_id field exists
    
    const companyIds: (string | undefined)[] = [undefined] // Add company IDs here if needed

    const results = []

    for (const companyId of companyIds) {
      try {
        const digest = await generateWeeklyDigest(companyId)
        results.push({
          companyId: companyId || 'default',
          success: true,
          digestId: digest.id,
          period: `${digest.periodFrom} to ${digest.periodTo}`,
        })

        console.log('[Weekly Digest Cron] Generated digest:', {
          companyId: companyId || 'default',
          digestId: digest.id,
          period: `${digest.periodFrom} to ${digest.periodTo}`,
        })
      } catch (error: any) {
        results.push({
          companyId: companyId || 'default',
          success: false,
          error: error.message?.substring(0, 200), // Limit log size
        })

        console.error('[Weekly Digest Cron] Failed to generate digest:', {
          companyId: companyId || 'default',
          error: error.message?.substring(0, 500), // Limit log size
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error: any) {
    console.error('[Weekly Digest Cron] Unexpected error:', {
      error: error.message?.substring(0, 500), // Limit log size
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

