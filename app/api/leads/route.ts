import { NextRequest } from 'next/server'

function getEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const { name, phone, city, email, source = 'whatsapp' } = body ?? {}
  if (!name || !phone) {
    return new Response('Missing required fields', { status: 400 })
  }

  try {
    const SUPABASE_URL = getEnv('SUPABASE_URL')
    const SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')

    // Формируем сообщение для last_message и notes
    const message = `Телефон: ${phone}${city ? `\nГород: ${city}` : ''}${email ? `\nEmail: ${email}` : ''}`
    
    const payload: any = {
      name,
      phone,
      source,
      last_message: message,
      last_message_at: new Date().toISOString(),
      notes: city || email || null,
    }

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Profile': 'public',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify([payload]),
      cache: 'no-store',
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('Supabase insert error:', resp.status, errText)
      return new Response(JSON.stringify({ error: 'Supabase error', status: resp.status, detail: errText }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (e: any) {
    console.error('Leads API error', e)
    return new Response(JSON.stringify({ error: 'Server error', detail: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response('OK', { status: 200 })
}

