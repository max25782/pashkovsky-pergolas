/**
 * POST /api/sendPergolaConfig
 * Saves 3D configurator config + screenshot; optional linkToken binds to offer (preview, 2D sync).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { applyConfiguratorSubmissionToOffer } from '@/lib/configurator/apply-configurator-to-offer'
import { uploadConfiguratorScreenshot } from '@/lib/configurator/upload-configurator-screenshot'
import type { PergolaParamsPayload } from '@/lib/configurator/apply-configurator-to-offer'
import { verifyTurnstile } from '@/lib/captcha/turnstile'
import { galleryLimiter, checkLimit, getClientIp } from '@/lib/rate-limit'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createServiceClient(): SupabaseClient | undefined {
  if (!url || !serviceKey) return undefined
  return createClient(url, serviceKey, { db: { schema: 'public' } })
}

function siteBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.VERCEL_URL?.replace(/^(?!https)/, 'https://').replace(/\/$/, '') ||
    ''
  )
}

// Rate limit: reuse gallery limiter bucket (60 req/min per IP) for configurator saves
const configuratorLimiter = galleryLimiter

export async function POST(req: NextRequest) {
  // 1. IP rate limit
  const ip = getClientIp(req)
  const rl = await checkLimit(configuratorLimiter, `config:${ip}`)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  // 2. Always require service role — anon fallback removed so DB INSERT policy is enforced
  const serviceSupabase = createServiceClient()
  if (!serviceSupabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  const insertClient = serviceSupabase

  try {
    const body = await req.json()
    const linkToken = typeof body.linkToken === 'string' ? body.linkToken.trim() : ''
    const screenshot = typeof body.screenshot === 'string' ? body.screenshot : null

    // 3. Turnstile CAPTCHA — required for non-linked saves (public submissions)
    // Linked saves (customer editing a specific offer via linkToken) are already gated by the token.
    if (!linkToken) {
      const turnstileToken = typeof body['cf-turnstile-response'] === 'string'
        ? body['cf-turnstile-response']
        : null
      const captcha = await verifyTurnstile(turnstileToken, ip)
      if (!captcha.success) {
        return NextResponse.json(
          { error: 'CAPTCHA verification failed. Please try again.' },
          { status: 403 },
        )
      }
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid config' }, { status: 400 })
    }

    const configForRow = { ...body } as Record<string, unknown>
    delete configForRow.linkToken
    delete configForRow.screenshot

    let offerId: string | null = null
    let tokenRowId: string | null = null
    let locale = 'he'
    let customerViewUrl = ''
    let editUrl = ''

    if (linkToken) {
      if (!serviceSupabase) {
        return NextResponse.json({ error: 'Linked save requires service role' }, { status: 500 })
      }
      const { data: tok, error: tokErr } = await serviceSupabase
        .from('configurator_link_tokens')
        .select('id, offer_id, expires_at, revoked_at, locale')
        .eq('token', linkToken)
        .maybeSingle()

      if (tokErr || !tok) {
        return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
      }
      if (tok.revoked_at) {
        return NextResponse.json({ error: 'Link revoked' }, { status: 403 })
      }
      const exp = new Date(tok.expires_at as string).getTime()
      if (Number.isFinite(exp) && exp < Date.now()) {
        return NextResponse.json({ error: 'Link expired' }, { status: 403 })
      }
      offerId = tok.offer_id as string
      tokenRowId = tok.id as string
      locale = (tok.locale as string) || 'he'
      const base = siteBaseUrl()
      editUrl = base
        ? `${base}/${locale}/pergola3d?ct=${encodeURIComponent(linkToken)}`
        : `/${locale}/pergola3d?ct=${encodeURIComponent(linkToken)}`
      customerViewUrl = `${editUrl}${editUrl.includes('?') ? '&' : '?'}view=1`
    }

    const screenshotStored =
      screenshot && screenshot.length < 50000 ? screenshot : null

    const { data: inserted, error: insErr } = await insertClient
      .from('pergola_config_submissions')
      .insert({
        config: configForRow as Record<string, unknown>,
        screenshot: screenshotStored,
        offer_id: offerId,
        configurator_token_id: tokenRowId,
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('[sendPergolaConfig] Insert error:', insErr)
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }

    const submissionId = inserted?.id as string

    if (linkToken && offerId && serviceSupabase) {
      let previewUrl: string | null = null
      if (screenshot && screenshot.startsWith('data:image/')) {
        previewUrl = await uploadConfiguratorScreenshot(serviceSupabase, offerId, screenshot)
      }

      const pergolaParams: PergolaParamsPayload = {
        widthCm: Number(configForRow.widthCm) || 0,
        depthCm: Number(configForRow.depthCm) || 0,
        heightCm: Number(configForRow.heightCm) || 0,
        color: String(configForRow.color ?? ''),
        lamellaAngleDeg: Number(configForRow.lamellaAngleDeg) || 0,
        attachedToWall: Boolean(configForRow.attachedToWall),
        lamellaGapCm: Number(configForRow.lamellaGapCm) || 0,
      }

      try {
        await applyConfiguratorSubmissionToOffer({
          supabase: serviceSupabase,
          offerId,
          pergolaParams,
          previewImageUrl: previewUrl,
          viewUrl: customerViewUrl,
          editUrl,
          submissionId,
        })
      } catch (e) {
        console.error('[sendPergolaConfig] apply to offer:', e)
      }

      const prefill = {
        widthCm: pergolaParams.widthCm,
        depthCm: pergolaParams.depthCm,
        heightCm: pergolaParams.heightCm,
        color: pergolaParams.color,
        lamellaAngleDeg: pergolaParams.lamellaAngleDeg,
        attachedToWall: pergolaParams.attachedToWall,
        lamellaGapCm: pergolaParams.lamellaGapCm,
      }
      await serviceSupabase
        .from('configurator_link_tokens')
        .update({ prefill_config: prefill })
        .eq('id', tokenRowId)
    }

    return NextResponse.json({ success: true, submissionId })
  } catch (e) {
    console.error('[sendPergolaConfig] Error:', e)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
