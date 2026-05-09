/**
 * Cron endpoint: send trial-ending reminders.
 *
 * POST /api/cron/trial-reminders?token=...
 *
 * Strategy:
 *   - Look up all companies whose trial_ends_at is within the next 3 days (and not already past)
 *   - For each, find the owner email and send a reminder
 *   - Track sent reminders in companies.trial_reminder_sent_at to avoid duplicates within 24h
 *
 * Schedule via Vercel Cron daily at 09:00 Asia/Jerusalem.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import {
  generateTrialEndingHTML,
  generateTrialEndingSubject,
} from '@/lib/email/templates/early-bird'

export const dynamic = 'force-dynamic'

const CRON_SECRET_TOKEN = process.env.CRON_SECRET_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

const REMINDER_WINDOW_DAYS = 3
const REMINDER_DEDUP_HOURS = 24

interface CompanyRow {
  id: string
  name: string
  primary_email: string | null
  trial_ends_at: string
  early_bird_position: number | null
  trial_reminder_sent_at: string | null
}

export async function POST(req: NextRequest) {
  if (!CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  const { searchParams } = new URL(req.url)
  if (searchParams.get('token') !== CRON_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!supabase) {
    return NextResponse.json({ error: 'DB not configured' }, { status: 500 })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const dedupCutoff = new Date(now.getTime() - REMINDER_DEDUP_HOURS * 60 * 60 * 1000)

  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, name, primary_email, trial_ends_at, early_bird_position, trial_reminder_sent_at')
    .not('trial_ends_at', 'is', null)
    .gte('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', windowEnd.toISOString())

  if (error) {
    console.error('[Trial Reminders] DB error:', error)
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
  }

  const stats = { considered: 0, sent: 0, skipped: 0, failed: 0 }

  for (const c of (companies || []) as CompanyRow[]) {
    stats.considered++

    if (!c.primary_email) {
      stats.skipped++
      continue
    }

    if (c.trial_reminder_sent_at && new Date(c.trial_reminder_sent_at) > dedupCutoff) {
      stats.skipped++
      continue
    }

    const msLeft = new Date(c.trial_ends_at).getTime() - now.getTime()
    const daysLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24)))

    // Find owner full name (best effort — fall back to email)
    let fullName = c.primary_email.split('@')[0]
    const { data: owner } = await supabase
      .from('company_members')
      .select('user_id, users:users!inner(full_name)')
      .eq('company_id', c.id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle()
    const ownerName = (owner as { users?: { full_name?: string } } | null)?.users?.full_name
    if (ownerName) fullName = ownerName

    const opts = {
      fullName,
      daysLeft,
      isEarlyBird: c.early_bird_position !== null,
      earlyBirdPosition: c.early_bird_position,
    }

    try {
      await sendEmail({
        to: c.primary_email,
        subject: generateTrialEndingSubject(opts),
        html: generateTrialEndingHTML(opts),
      })

      await supabase
        .from('companies')
        .update({ trial_reminder_sent_at: now.toISOString() })
        .eq('id', c.id)

      stats.sent++
    } catch (err) {
      console.error(`[Trial Reminders] Send failed for ${c.id}:`, err)
      stats.failed++
    }
  }

  return NextResponse.json({ ok: true, ...stats })
}
