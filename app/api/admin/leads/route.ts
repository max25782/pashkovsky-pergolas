import { NextRequest } from 'next/server'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function auth(req: NextRequest) {
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function sbFetch(path: string, init?: RequestInit) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env')
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Profile': 'public',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const limit = Number(searchParams.get('limit') || 20)
  const offset = Number(searchParams.get('offset') || 0)

  const filters: string[] = []
  if (q) {
    // ilike on name/phone/notes
    const like = `*${q.replace(/\s+/g, '%')}*`
    filters.push(`or=(name.ilike.${like},phone.ilike.${like},notes.ilike.${like})`)
  }
  const query = `/rest/v1/leads?select=*&order=created_at.desc&limit=${limit}&offset=${offset}${filters.length ? `&${filters.join('&')}` : ''}`
  const r = await sbFetch(query)
  const data = await r.text()
  if (!r.ok) return new Response(data, { status: r.status })
  return new Response(data, { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  let body: any
  try { body = await req.json() } catch { return new Response('Bad JSON', { status: 400 }) }
  const { id, ...updates } = body || {}
  if (!id) return new Response('Missing id', { status: 400 })
  const r = await sbFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
  const text = await r.text()
  if (!r.ok) return new Response(text, { status: r.status })
  return new Response(text || 'OK')
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })
  const r = await sbFetch(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
  const text = await r.text()
  if (!r.ok) return new Response(text, { status: r.status })
  return new Response('OK')
}


