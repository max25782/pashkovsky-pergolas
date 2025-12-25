import type { NextRequest } from 'next/server'

// Helper to read env safely
function getEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export async function GET(req: NextRequest) {
  // Meta (Facebook) webhook verification
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  try {
    const verifyToken = getEnv('WHATSAPP_VERIFY_TOKEN')
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  } catch {
    return new Response('Server misconfigured', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  // Receive WhatsApp messages and store as leads in Supabase via REST API
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const entries: any[] = Array.isArray(body?.entry) ? body.entry : []
  const leads: any[] = []

  for (const entry of entries) {
    const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : []
    for (const ch of changes) {
      const val = ch?.value
      const messages: any[] = Array.isArray(val?.messages) ? val.messages : []
      const contacts: any[] = Array.isArray(val?.contacts) ? val.contacts : []
      if (!messages.length || !contacts.length) continue

      const msg = messages[0]
      const contact = contacts[0]
      const profileName: string | undefined = contact?.profile?.name
      const phone: string | undefined = contact?.wa_id ?? msg?.from
      const text: string | undefined = msg?.text?.body ?? msg?.button?.text ?? msg?.interactive?.nfm_reply?.response_json ?? ''
      const ts = Number(msg?.timestamp ?? Date.now())

      leads.push({
        name: profileName ?? null,
        phone: phone ?? null,
        message: text ?? null,
        source: 'whatsapp',
        wa_from_id: phone ?? null,
        wa_timestamp: ts,
      })
    }
  }

  if (!leads.length) return new Response('No leads', { status: 200 })

  try {
    const SUPABASE_URL = getEnv('SUPABASE_URL')
    const SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(leads),
      cache: 'no-store',
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Supabase insert error:', errText)
      return new Response('Supabase error', { status: 500 })
    }
  } catch (e) {
    console.error('Webhook error', e)
    return new Response('Server error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}


