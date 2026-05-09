// ==========================================
// GET /api/public/early-bird/spots
// ==========================================
// Public endpoint — no auth required.
// Used by the marketing landing to display the Early Bird counter.
//
// Returns: { remaining, total, isOpen }
//   - remaining: floored at FLOOR (5) to avoid scarcity panic at very low counts
//   - total: total cohort size
//   - isOpen: whether the cohort is genuinely still open (raw, not floored)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TOTAL_SPOTS = 20
const FLOOR = 5

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

export async function GET() {
  if (!supabase) {
    // Fail open: pretend cohort is full-ish to avoid blocking signups when DB is down
    return NextResponse.json(
      { remaining: FLOOR, total: TOTAL_SPOTS, isOpen: true },
      { headers: corsHeaders() }
    )
  }

  try {
    const { data, error } = await supabase.rpc('get_early_bird_spots_remaining')

    if (error) {
      console.error('[Early Bird Spots] RPC error:', error)
      return NextResponse.json(
        { remaining: FLOOR, total: TOTAL_SPOTS, isOpen: true },
        { headers: corsHeaders() }
      )
    }

    const rawRemaining = typeof data === 'number' ? data : TOTAL_SPOTS
    const isOpen = rawRemaining > 0
    const remaining = Math.max(FLOOR, rawRemaining)

    return NextResponse.json(
      { remaining, total: TOTAL_SPOTS, isOpen },
      { headers: corsHeaders() }
    )
  } catch (err) {
    console.error('[Early Bird Spots] Error:', err)
    return NextResponse.json(
      { remaining: FLOOR, total: TOTAL_SPOTS, isOpen: true },
      { headers: corsHeaders() }
    )
  }
}
