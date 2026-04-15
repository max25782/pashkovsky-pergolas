/**
 * Facebook Lead Ads Webhook
 * POST /api/webhooks/facebook-leads
 *
 * Meta sends GET for verification, POST for leadgen events.
 * Configure in Meta for Developers: Webhooks → Page → leadgen
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhoneIL } from '@/lib/middleware/integration-access'

const VERIFY_TOKEN = process.env.FB_LEADS_VERIFY_TOKEN || 'pashkovsky-leads-verify-2024'
const APP_SECRET = process.env.FB_APP_SECRET
const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN
const COMPANY_ID = process.env.FB_LEADS_COMPANY_ID

const supabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
    : null

/** GET - Meta webhook verification */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
  return new Response('Forbidden', { status: 403 })
}

/** POST - Leadgen events */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })

  // Meta may send hub.mode for verification in POST too
  if (body['hub.mode'] === 'subscribe') {
    return new Response('OK', { status: 200 })
  }

  const leadgenIds: string[] = []

  // Production format: body.entry[].changes[].value.leadgen_id
  const entries: Array<{ changes?: Array<{ field: string; value?: { leadgen_id?: string } }> }> =
    body.entry || []
  for (const entry of entries) {
    for (const ch of entry.changes || []) {
      if (ch.field === 'leadgen' && ch.value?.leadgen_id) {
        leadgenIds.push(ch.value.leadgen_id)
      }
    }
  }

  // Test format from Meta panel: body.sample.value.leadgen_id
  if (leadgenIds.length === 0 && body.sample?.field === 'leadgen' && body.sample?.value?.leadgen_id) {
    leadgenIds.push(body.sample.value.leadgen_id)
  }

  if (leadgenIds.length === 0 || !supabase || !COMPANY_ID) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (!PAGE_ACCESS_TOKEN) {
    console.warn('[FB Leads] FB_PAGE_ACCESS_TOKEN not set, skipping lead fetch')
    return NextResponse.json({ received: true }, { status: 200 })
  }

  for (const leadgenId of leadgenIds) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`
      )
      if (!res.ok) {
        console.error('[FB Leads] Graph API error:', await res.text())
        continue
      }
      const data = (await res.json()) as {
        id: string
        created_time: string
        field_data?: Array<{ name: string; values: string[] }>
      }
      const fieldData = data.field_data || []
      const getField = (name: string) =>
        fieldData.find((f) => f.name === name)?.values?.[0] || null

      const name = getField('full_name') || getField('first_name') || 'Unknown'
      const phone = getField('phone_number') || getField('phone')
      const email = getField('email')

      if (!phone || phone.replace(/\D/g, '').length < 9) {
        console.warn('[FB Leads] Skipping lead without valid phone:', leadgenId)
        continue
      }

      const normalizedPhone = normalizePhoneIL(phone)
      const standardFields = ['full_name', 'first_name', 'phone_number', 'phone', 'email']
      const customFields = fieldData.filter((f) => !standardFields.includes(f.name))
      const message =
        customFields.map((f) => `${f.name}: ${f.values?.join(', ')}`).join('; ') || null

      await supabase.from('leads').insert({
        company_id: COMPANY_ID,
        name,
        phone: normalizedPhone,
        email: email || null,
        message: message || null,
        source: 'facebook',
        status: 'waiting',
        metadata: { fb_leadgen_id: leadgenId, fb_created_time: data.created_time },
      })
    } catch (e) {
      console.error('[FB Leads] Error processing lead:', e)
    }
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
