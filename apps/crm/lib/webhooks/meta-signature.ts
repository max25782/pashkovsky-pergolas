/**
 * X-Hub-Signature-256 verification for Meta (Facebook / WhatsApp) webhooks.
 *
 * Meta signs the exact bytes of the request body with the app secret:
 *
 *   X-Hub-Signature-256: sha256=<hex HMAC-SHA256(raw_body, app_secret)>
 *
 * The body therefore has to be read as text and verified before parsing —
 * `req.json()` discards the original bytes, and re-serializing the parsed value
 * produces a different digest (key order, whitespace, unicode escapes).
 *
 * Without this check anyone who knows the webhook URL can insert leads, which
 * is what both routes previously allowed.
 *
 * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

const SIGNATURE_HEADER = 'x-hub-signature-256'
const SIGNATURE_PREFIX = 'sha256='

export type VerifiedMetaBody =
  | { ok: true; body: unknown }
  /** `status` is what the route should return: 401 for signature problems, 400 for a malformed signed body. */
  | { ok: false; status: 401 | 400; reason: string }

function digestsMatch(expectedHex: string, providedHex: string): boolean {
  // timingSafeEqual throws when the buffers differ in length, so screen that
  // first. Length alone leaks nothing: it is fixed for SHA-256.
  if (expectedHex.length !== providedHex.length) return false

  const expected = Buffer.from(expectedHex, 'hex')
  const provided = Buffer.from(providedHex, 'hex')
  if (expected.length !== provided.length) return false

  return timingSafeEqual(expected, provided)
}

/**
 * Verify the signature over the raw body and return the parsed payload.
 *
 * `appSecret` must already be known to be present; callers guard their
 * configuration separately so a missing secret is reported as a 500 rather than
 * being mistaken for a bad signature.
 */
export async function readVerifiedMetaBody(
  req: NextRequest,
  appSecret: string,
): Promise<VerifiedMetaBody> {
  const header = req.headers.get(SIGNATURE_HEADER)
  if (!header) {
    return { ok: false, status: 401, reason: 'missing X-Hub-Signature-256' }
  }
  if (!header.startsWith(SIGNATURE_PREFIX)) {
    return { ok: false, status: 401, reason: 'unsupported signature algorithm' }
  }

  const raw = await req.text()
  const expected = createHmac('sha256', appSecret).update(raw, 'utf8').digest('hex')
  const provided = header.slice(SIGNATURE_PREFIX.length).trim().toLowerCase()

  if (!digestsMatch(expected, provided)) {
    return { ok: false, status: 401, reason: 'signature mismatch' }
  }

  try {
    return { ok: true, body: JSON.parse(raw) as unknown }
  } catch {
    return { ok: false, status: 400, reason: 'signed body is not valid JSON' }
  }
}
