import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export async function GET(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  const limit = Number(searchParams.get('limit') || 20)
  const offset = Number(searchParams.get('offset') || 0)

  let query = supabase.from('leads').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (q) {
    const like = `%${q.replace(/\s+/g, '%')}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like},notes.ilike.${like}`)
  }
  const { data, error } = await query
  if (error) return new Response(JSON.stringify(error), { status: 400 })
  return new Response(JSON.stringify(data ?? []), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  let body: any
  try { body = await req.json() } catch { return new Response('Bad JSON', { status: 400 }) }
  const { id, ...updates } = body || {}
  if (!id) return new Response('Missing id', { status: 400 })
  const { error } = await supabase.from('leads').update(updates).eq('id', id)
  if (error) return new Response(JSON.stringify(error), { status: 400 })
  return new Response('OK')
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) return new Response(JSON.stringify(error), { status: 400 })
  return new Response('OK')
}


