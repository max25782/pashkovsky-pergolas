/**
 * Score a single lead
 * 
 * POST /api/leads/[id]/score
 * Auth: JWT (Bearer) or x-admin-token
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { scoreLead } from '@/lib/leads/scoring'
import type { Lead } from '@/components/admin/lead-types'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : null

async function isAuthorized(req: NextRequest): Promise<boolean> {
  // JWT (authFetch from logged-in user)
  const authCheck = await requireAuthAsync(req)
  if (authCheck.authorized) return true
  // Legacy: ADMIN_TOKEN
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Check auth (JWT or admin token)
    if (!(await isAuthorized(req))) {
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

    const leadId = params.id

    // 2. Fetch lead
    const { data: leadData, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !leadData) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    // 3. Check for duplicates (same phone)
    const { data: duplicates } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', leadData.phone)
      .neq('id', leadId)

    const isDuplicate = (duplicates?.length || 0) > 0

    // 4. Calculate response time
    let responseTimeMinutes: number | null = null
    if (leadData.created_at && leadData.last_message_at) {
      const created = new Date(leadData.created_at)
      const lastMessage = new Date(leadData.last_message_at)
      responseTimeMinutes = Math.round((lastMessage.getTime() - created.getTime()) / (1000 * 60))
    }

    // 5. Score the lead
    const scoringResult = await scoreLead(
      leadData as Lead,
      {
        isDuplicate,
        responseTimeMinutes,
        hasAttachments: false, // Can be enhanced if attachments are tracked
      },
      true // Use AI
    )

    // 6. Save score to database
    const { error: updateError } = await supabase
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
      .eq('id', leadId)

    if (updateError) {
      console.error('[Lead Scoring] Failed to save score:', updateError.message?.substring(0, 200))
      // Don't fail - return result anyway
    }

    // 7. Return result
    return NextResponse.json({
      finalScore: scoringResult.finalScore,
      ruleScore: scoringResult.ruleScore,
      aiDelta: scoringResult.aiDelta,
      reasons: scoringResult.reasons,
      aiReasons: scoringResult.aiReasons,
      suggestedNextAction: scoringResult.suggestedNextAction,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[Lead Scoring] Error:', {
      error: msg?.substring(0, 500), // Limit log size
      leadId: params.id,
    })

    return NextResponse.json(
      { error: 'Failed to score lead', details: msg },
      { status: 500 }
    )
  }
}

