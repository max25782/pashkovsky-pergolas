/**
 * Cloudflare Turnstile — server-side token verification (site app).
 *
 * Required env vars:
 *   TURNSTILE_SECRET_KEY   — from Cloudflare dashboard (Widget → Secret Key)
 *
 * Fails open when not configured so local dev works without a widget.
 */

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
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set — skipping verification')
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
      console.error('[Turnstile] Siteverify HTTP error:', res.status)
      return { success: true }
    }

    const data = await res.json() as { success: boolean; 'error-codes'?: string[] }
    return { success: data.success, errorCodes: data['error-codes'] }
  } catch (err) {
    console.error('[Turnstile] Network error during verification:', err)
    return { success: true }
  }
}
