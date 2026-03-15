/**
 * Send WhatsApp template message via Meta Cloud API.
 * Used for auto-reply to new leads (e.g. template "hi").
 *
 * Env: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_NAME
 */

const API_VERSION = 'v21.0'

function normalizePhone(phone: string): string {
  // Remove spaces, dashes, parentheses
  let n = phone.replace(/[\s\-\(\)]/g, '')
  // Israeli: 05x -> 9725x, +972 -> 972
  if (n.startsWith('0')) n = '972' + n.slice(1)
  if (n.startsWith('+')) n = n.slice(1)
  if (n.startsWith('972')) return n
  if (n.length === 9 && n.startsWith('5')) return '972' + n
  return n
}

export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams?: string[],
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneId) {
    return { ok: false, error: 'WhatsApp not configured' }
  }

  const normalizedTo = normalizePhone(to)
  if (normalizedTo.length < 10) {
    console.warn('[WhatsApp] Invalid phone:', to)
    return { ok: false, error: 'Invalid phone number' }
  }

  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: 'he' },
  }
  if (bodyParams && bodyParams.length > 0) {
    ;(template as { components?: unknown[] }).components = [
      {
        type: 'body',
        parameters: bodyParams.map((t) => ({ type: 'text', text: t })),
      },
    ]
  }

  const body = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'template',
    template,
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      },
    )

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const errMsg = (data as { error?: { message?: string } })?.error?.message ?? res.statusText
      console.error('[WhatsApp] API error:', res.status, errMsg)
      return { ok: false, error: errMsg }
    }

    console.log('[WhatsApp] Sent template', templateName, 'to', normalizedTo)
    return { ok: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[WhatsApp] Send failed:', msg)
    return { ok: false, error: msg }
  }
}
