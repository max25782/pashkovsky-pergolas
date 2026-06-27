/**
 * Cloudflare Turnstile — server-side token verification.
 *
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 *
 * Required env vars:
 *   TURNSTILE_SECRET_KEY   — from Cloudflare dashboard (Widget → Secret Key)
 *
 * Fails open (returns { success: true }) when the secret key is not configured
 * so local development works without a real Turnstile widget.
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

  // Fail open in dev — log so it's visible
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
      // Fail open on Cloudflare-side errors to avoid blocking legit users
      return { success: true }
    }

    const data = await res.json() as { success: boolean; 'error-codes'?: string[] }
    return { success: data.success, errorCodes: data['error-codes'] }
  } catch (err) {
    console.error('[Turnstile] Network error during verification:', err)
    // Fail open on network errors
    return { success: true }
  }
}
