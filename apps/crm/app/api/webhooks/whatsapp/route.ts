/**
 * WhatsApp Cloud API Webhook
 * POST /api/webhooks/whatsapp
 *
 * Inbound messages are stored as leads. Meta signs every POST, so the signature
 * is verified against the app secret before anything is written.
 */

import type { NextRequest } from 'next/server'
import { firstEnv, missingEnv } from '@/lib/env/require-env'
import { readVerifiedMetaBody } from '@/lib/webhooks/meta-signature'

/** WhatsApp and Lead Ads usually live in the same Meta app, so one secret covers both. */
const APP_SECRET_VARS = ['WHATSAPP_APP_SECRET', 'FB_APP_SECRET'] as const
const VERIFY_TOKEN_VARS = ['WHATSAPP_VERIFY_TOKEN', 'FB_LEADS_VERIFY_TOKEN'] as const
const COMPANY_ID_VARS = ['FB_LEADS_COMPANY_ID', 'DEFAULT_COMPANY_ID'] as const

interface WhatsAppLead {
  name: string | null
  phone: string | null
  message: string | null
  source: 'whatsapp'
  metadata: { wa_from_id: string | null; wa_timestamp: number }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = firstEnv(...VERIFY_TOKEN_VARS)
  if (!verifyToken) {
    console.error(`[WhatsApp] No verify token configured (set one of: ${VERIFY_TOKEN_VARS.join(', ')})`)
    return new Response('Server misconfigured', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

function extractLeads(body: unknown): WhatsAppLead[] {
  const entries = (body as { entry?: unknown[] } | null)?.entry
  if (!Array.isArray(entries)) return []

  const leads: WhatsAppLead[] = []

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] } | null)?.changes
    if (!Array.isArray(changes)) continue

    for (const ch of changes) {
      const val = (ch as { value?: Record<string, unknown> } | null)?.value
      const messages = val?.messages
      const contacts = val?.contacts
      if (!Array.isArray(messages) || !messages.length) continue
      if (!Array.isArray(contacts) || !contacts.length) continue

      const msg = messages[0] as Record<string, any>
      const contact = contacts[0] as Record<string, any>
      const profileName: string | undefined = contact?.profile?.name
      const phone: string | undefined = contact?.wa_id ?? msg?.from
      const text: string =
        msg?.text?.body ?? msg?.button?.text ?? msg?.interactive?.nfm_reply?.response_json ?? ''

      leads.push({
        name: profileName ?? null,
        phone: phone ?? null,
        message: text || null,
        source: 'whatsapp',
        metadata: {
          wa_from_id: phone ?? null,
          wa_timestamp: Number(msg?.timestamp ?? Date.now()),
        },
      })
    }
  }

  return leads
}

export async function POST(req: NextRequest) {
  // Configuration is checked before the signature so an unset secret is
  // reported as an operator error rather than as a rejected request.
  const appSecret = firstEnv(...APP_SECRET_VARS)
  if (!appSecret) {
    console.error(`[WhatsApp] No app secret configured (set one of: ${APP_SECRET_VARS.join(', ')})`)
    return new Response('Server misconfigured', { status: 500 })
  }

  const missing = missingEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseUrl = firstEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
  const companyId = firstEnv(...COMPANY_ID_VARS)
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!companyId) missing.push(COMPANY_ID_VARS.join('|'))
  if (missing.length) {
    console.error('[WhatsApp] Missing configuration:', missing.join(', '))
    return new Response('Server misconfigured', { status: 500 })
  }

  const verified = await readVerifiedMetaBody(req, appSecret)
  if (!verified.ok) {
    console.warn('[WhatsApp] Rejected webhook:', verified.reason)
    return new Response(verified.status === 401 ? 'Unauthorized' : 'Bad Request', {
      status: verified.status,
    })
  }

  const leads = extractLeads(verified.body)
  if (!leads.length) return new Response('No leads', { status: 200 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    const payload = leads.map(({ metadata, ...rest }) => ({
      ...rest,
      company_id: companyId,
      status: 'waiting',
      metadata,
    }))

    const resp = await fetch(`${supabaseUrl}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!resp.ok) {
      console.error('[WhatsApp] Supabase insert error:', await resp.text())
      return new Response('Supabase error', { status: 500 })
    }
  } catch (e) {
    console.error('[WhatsApp] Webhook error', e)
    return new Response('Server error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}
