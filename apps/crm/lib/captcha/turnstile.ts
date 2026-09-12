/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Required env vars:
 *   TURNSTILE_SECRET_KEY   — from Cloudflare dashboard (Widget → Secret Key)
 *
 * Outside production a missing secret key fails open so local development works
 * without a real Turnstile widget. In production a missing key is an operator
 * error and fails closed: silently accepting every submission would leave the
 * public forms with no bot protection at all.
 */

import { isProduction } from '@/lib/env/require-env'

interface TurnstileOutcome {
  success: boolean
  errorCodes?: string[]
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileOutcome> {
  const secret = process.env.TURNSTILE_SECRET_KEY

  if (!secret) {
    if (isProduction) {
      console.error('[Turnstile] TURNSTILE_SECRET_KEY not set — rejecting submission')
      return { success: false, errorCodes: ['misconfigured'] }
    }
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set — skipping verification (dev only)')
    return { success: true }
  }

  if (!token) {
    return { success: false, errorCodes: ['missing-input-response'] }
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(ip ? { remoteip: ip } : {}),
  })

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      // Deliberately fail open: unlike a missing secret this is Cloudflare
      // being unavailable, and refusing every lead for the duration of a
      // third-party outage costs more than the bots it would stop.
      console.error('[Turnstile] Siteverify HTTP error:', res.status)
      return { success: true }
    }

    const data = await res.json() as { success: boolean; 'error-codes'?: string[] }
    return { success: data.success, errorCodes: data['error-codes'] }
  } catch (err) {
    // Same reasoning as the HTTP-error branch above.
    console.error('[Turnstile] Network error during verification:', err)
    return { success: true }
  }
}
