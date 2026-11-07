import { NextRequest, NextResponse } from 'next/server'
import { canSendRealLeads, readLeadModeEnv } from '@/lib/new-site/lead-mode'
import { parseLeadPayload, toCrmPayload } from '@/lib/new-site/lead-schema'
import { checkLimit, getClientIp, leadsLimiter } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const CRM_TIMEOUT_MS = 10_000

/**
 * Lead intake for the new site (/new).
 *
 * Disabled unless ALL of these hold: NEXT_PUBLIC_LEADS_DEMO='false', LEADS_REAL_ENABLED='true'
 * and VERCEL_ENV='production' (see lib/new-site/lead-mode.ts). On Preview and locally the answer is
 * always 403 and nothing is forwarded, so no Preview deployment can write to the live CRM/database.
 */
export async function POST(request: NextRequest) {
  if (!canSendRealLeads(readLeadModeEnv())) {
    return NextResponse.json({ error: 'leads_disabled' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}

  // Honeypot: look successful to the bot, forward nothing.
  if (typeof record.website === 'string' && record.website.trim() !== '') {
    return NextResponse.json({ success: true })
  }

  const parsed = parseLeadPayload(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: 'validation_failed', errors: parsed.errors }, { status: 422 })
  }

  const ip = getClientIp(request)
  const limit = await checkLimit(leadsLimiter, ip)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 900) } },
    )
  }

  const siteToken = process.env.CRM_SITE_TOKEN ?? process.env.NEXT_PUBLIC_CRM_SITE_TOKEN
  if (siteToken === undefined || siteToken === '') {
    console.error('[api/leads] CRM site token is not configured')
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 })
  }

  const crmUrl = process.env.NEXT_PUBLIC_CRM_API_URL || 'https://crm.pashkovsky-group.com'
  const turnstile = typeof record['cf-turnstile-response'] === 'string' ? record['cf-turnstile-response'] : null

  try {
    const response = await fetch(`${crmUrl}/api/public/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-site-token': siteToken, 'x-forwarded-for': ip },
      body: JSON.stringify({ ...toCrmPayload(parsed.payload), 'cf-turnstile-response': turnstile }),
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
    })
    if (!response.ok) {
      console.error('[api/leads] CRM rejected the lead', { status: response.status })
      return NextResponse.json({ error: 'upstream_failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/leads] CRM request failed', error)
    return NextResponse.json({ error: 'upstream_failed' }, { status: 502 })
  }
}
