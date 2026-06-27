/**
 * Batch score leads
 * 
 * POST /api/leads/score/batch?period=last30days
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scoreLead } from '@/lib/leads/scoring'
import type { Lead } from '@/components/admin/lead-types'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : null

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

    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      )
    }

    // 2. Parse period and required company_id
    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'last30days'
    const companyId = searchParams.get('company_id')

    // company_id is mandatory to prevent cross-tenant data processing
    if (!companyId) {
      return NextResponse.json(
        { error: 'company_id query parameter is required' },
        { status: 400 }
      )
    }

    let dateFilter: { from: string; to: string }
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    switch (period) {
      case 'last7days': {
        const from = new Date(today)
        from.setDate(from.getDate() - 7)
        dateFilter = {
          from: from.toISOString().split('T')[0],
          to: todayStr,
        }
        break
      }
      case 'last30days': {
        const from = new Date(today)
        from.setDate(from.getDate() - 30)
        dateFilter = {
          from: from.toISOString().split('T')[0],
          to: todayStr,
        }
        break
      }
      default:
        return NextResponse.json(
          { error: 'Invalid period. Use: last7days, last30days' },
          { status: 400 }
        )
    }

    // 3. Fetch leads in period — scoped to requested company only
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('company_id', companyId)
      .gte('created_at', `${dateFilter.from}T00:00:00Z`)
      .lte('created_at', `${dateFilter.to}T23:59:59Z`)
      .order('created_at', { ascending: false })

    if (leadsError) {
      return NextResponse.json(
        { error: 'Failed to fetch leads' },
        { status: 500 }
      )
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        scored: 0,
        results: [],
      })
    }

    // 4. Get all phones for duplicate detection
    const phones = new Map<string, string[]>()
    leads.forEach(lead => {
      if (lead.phone) {
        if (!phones.has(lead.phone)) {
          phones.set(lead.phone, [])
        }
        phones.get(lead.phone)!.push(lead.id)
      }
    })

    // 5. Score each lead
    const results = []
    let scored = 0
    let failed = 0

    for (const lead of leads) {
      try {
        // Check if duplicate
        const duplicateIds = phones.get(lead.phone || '') || []
        const isDuplicate = duplicateIds.length > 1

        // Calculate response time
        let responseTimeMinutes: number | null = null
        if (lead.created_at && lead.last_message_at) {
          const created = new Date(lead.created_at)
          const lastMessage = new Date(lead.last_message_at)
          responseTimeMinutes = Math.round((lastMessage.getTime() - created.getTime()) / (1000 * 60))
        }

        // Score lead
        const scoringResult = await scoreLead(
          lead as Lead,
          {
            isDuplicate,
            responseTimeMinutes,
            hasAttachments: false,
          },
          true // Use AI
        )

        // Save to database
        await supabase
          .from('leads')
          .update({
            score: scoringResult.finalScore,
            score_updated_at: new Date().toISOString(),
            score_breakdown_json: {
              ruleScore: scoringResult.ruleScore,
              aiDelta: scoringResult.aiDelta,
              reasons: scoringResult.reasons,
              aiReasons: scoringResult.aiReasons,
              suggestedNextAction: scoringResult.suggestedNextAction,
            },
          })
          .eq('id', lead.id)

        results.push({
          leadId: lead.id,
          score: scoringResult.finalScore,
          success: true,
        })

        scored++
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[Batch Scoring] Failed to score lead:', {
          leadId: lead.id,
          error: msg?.substring(0, 200), // Limit log size
        })

        results.push({
          leadId: lead.id,
          score: null,
          success: false,
          error: msg?.substring(0, 100),
        })

        failed++
      }
    }

    return NextResponse.json({
      success: true,
      period: dateFilter,
      total: leads.length,
      scored,
      failed,
      results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Batch Scoring] Error:', {
      error: msg?.substring(0, 500),
    })

    return NextResponse.json(
      { error: 'Failed to batch score leads' },
      { status: 500 }
    )
  }
}

