/**
 * Zapier Leads Webhook
 * POST /api/webhooks/zapier-leads
 *
 * Accepts leads from Zapier (Facebook Lead Ads → Webhooks by Zapier).
 * Auth: x-zapier-secret header must match ZAPIER_LEADS_SECRET
 *
 * Zap setup: Facebook Lead Ads (New Lead) → Webhooks by Zapier (POST)
 * URL: https://crm.pashkovsky-group.com/api/webhooks/zapier-leads
 * Payload Type: JSON
 * Headers: x-zapier-secret = <ZAPIER_LEADS_SECRET>
 *
 * Map fields: full_name or first_name → name, phone_number or phone → phone, email → email
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhoneIL } from '@/lib/middleware/integration-access'
import { sendWhatsAppTemplate } from '@/lib/whatsapp-send'

const SECRET = process.env.ZAPIER_LEADS_SECRET
const COMPANY_ID = process.env.FB_LEADS_COMPANY_ID || process.env.DEFAULT_COMPANY_ID

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
    : null

function getString(obj: unknown, ...keys: string[]): string | null {
  if (obj === null || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!supabase || !COMPANY_ID) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  if (SECRET) {
    const provided = req.headers.get('x-zapier-secret')
    if (provided !== SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name =
    getString(body, 'full_name', 'ful_name', 'fullName', 'first_name', 'name', 'Full Name', 'First Name') ||
    'Unknown'
  const phoneRaw =
    getString(body, 'phone_number', 'phone', 'Phone Number', 'Phone', 'מספר טלפון') || ''
  const phone = normalizePhoneIL(phoneRaw)
  const email = getString(body, 'email', 'Email', 'אימייל')
  const city = getString(body, 'city', 'City', 'עיר')
  const sourceRaw = getString(body, 'source', 'Source')
  const source = sourceRaw ? sourceRaw.toLowerCase() : 'facebook'

  if (!phone || phone.replace(/\D/g, '').length < 9) {
    return NextResponse.json(
      { error: 'Valid phone required (min 9 digits)', received: body },
      { status: 400 }
    )
  }

  const obj = body as Record<string, unknown>
  const extraFields: string[] = []
  const skipKeys = new Set([
    'full_name',
    'ful_name',
    'fullName',
    'first_name',
    'name',
    'phone_number',
    'phone',
    'email',
    'Full Name',
    'First Name',
    'Phone Number',
    'Phone',
    'Email',
    'city',
    'City',
    'עיר',
    'source',
    'Source',
    'created_time',
    'id',
    'leadgen_id',
  ])
  for (const [k, v] of Object.entries(obj)) {
    if (skipKeys.has(k)) continue
    if (v != null && String(v).trim()) {
      extraFields.push(`${k}: ${String(v)}`)
    }
  }
  const message = extraFields.length > 0 ? extraFields.join('; ') : null

  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .eq('phone', phone)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, duplicate: true }, { status: 200 })
  }

  const { error } = await supabase
    .from('leads')
    .insert({
      company_id: COMPANY_ID,
      name,
      phone,
      email: email || null,
      city: city || null,
      message,
      source,
      status: 'pending',
      google_conv_sent: false,
      metadata: { zapier: true },
    })

  if (error) {
    console.error('[Zapier Leads] Insert error:', error)
    return NextResponse.json(
      { error: 'Failed to save lead', code: error.code },
      { status: 500 }
    )
  }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'hi'
  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    sendWhatsAppTemplate(phone, templateName, [name])
      .then((r) => {
        if (!r.ok) console.warn('[Zapier Leads] WhatsApp send failed:', r.error)
      })
      .catch((e) => console.warn('[Zapier Leads] WhatsApp send error:', e))
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function GET() {
  return NextResponse.json({
    service: 'zapier-leads',
    status: 'ok',
    hint: 'POST JSON with name, phone, email. Auth: x-zapier-secret header',
  })
}
