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

  const { name, phone, city, email, source = 'website' } = body ?? {}
  if (!name || !phone) {
    return new Response('Missing required fields', { status: 400 })
  }

  try {
    const SUPABASE_URL = getEnv('SUPABASE_URL')
    const SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY')

    // Prepare the payload - notes column stores city/email info
    const payload: any = {
      name,
      phone,
      source,
    }
    
    // The 'notes' column in Supabase is used to store city info
    if (city) {
      payload.notes = city
    }
    
    // If email is provided, append it to notes
    if (email) {
      payload.notes = payload.notes ? `${payload.notes}\nEmail: ${email}` : `Email: ${email}`
    }

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!resp.ok) {
      let errText: any
      try { errText = await resp.json() } catch { errText = await resp.text() }
      console.error('Supabase insert error:', resp.status, errText)
      return new Response(JSON.stringify({ error: 'Failed to submit lead' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (e: unknown) {
    console.error('Leads API error', e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response('OK', { status: 200 })
}

