/**
 * Cron endpoint: weekly owner report by e-mail.
 *
 * GET or POST /api/cron/weekly-owner-report
 *
 * Run hourly (vercel.json): each firm decides for itself whether it is due, from its own
 * weekday, hour and time zone, and the send log keeps a week from going out twice.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; an external scheduler can
 * use `?token=` with CRON_SECRET_TOKEN instead. Without a configured secret the route is closed.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runWeeklyReports } from '@/lib/reports/weekly-report-runner'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function isAuthorized(req: NextRequest): boolean | 'unconfigured' {
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_TOKEN].filter(
    (s): s is string => typeof s === 'string' && s !== '',
  )
  if (secrets.length === 0) return 'unconfigured'
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const token = new URL(req.url).searchParams.get('token') ?? ''
  return secrets.some((s) => (bearer !== '' && safeEqual(bearer, s)) || (token !== '' && safeEqual(token, s)))
}

async function handle(req: NextRequest) {
  const auth = isAuthorized(req)
  if (auth === 'unconfigured') {
    console.error('[weekly-owner-report] CRON_SECRET / CRON_SECRET_TOKEN not configured')
    return NextResponse.json({ error: 'Cron endpoint not configured' }, { status: 500 })
  }
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const results = await runWeeklyReports(supabase, new Date())
    const count = (outcome: string) => results.filter((r) => r.outcome === outcome).length
    return NextResponse.json({
      companies: results.length,
      sent: count('sent'),
      failed: count('failed'),
      results: results.filter((r) => r.outcome !== 'not_due' && r.outcome !== 'disabled'),
    })
  } catch (error) {
    console.error('[weekly-owner-report] run failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Weekly report run failed' },
      { status: 500 },
    )
  }
}

export const GET = handle
export const POST = handle
