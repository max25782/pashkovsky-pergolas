import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/middleware/auth'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - List all categories
export async function GET(req: NextRequest) {
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { data, error } = await supabase
    .from('gallery_categories')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('GET gallery categories error:', error)
    return new Response(JSON.stringify(error), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  return new Response(JSON.stringify({ data: data ?? [] }), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' } 
  })
}

// POST - Create a new category
export async function POST(req: NextRequest) {
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  let body: any
  try {
    body = await req.json()
  } catch (e) {
    console.error('POST: Bad JSON', e)
    return new Response('Bad JSON', { status: 400 })
  }
  
  const { key, name_he, name_ru, name_en, description_he, description_ru, description_en } = body || {}
  
  if (!key) {
    return new Response('Missing required field: key', { status: 400 })
  }
  
  const { data, error } = await supabase
    .from('gallery_categories')
    .insert({
      key,
      name_he: name_he || null,
      name_ru: name_ru || null,
      name_en: name_en || null,
      description_he: description_he || null,
      description_ru: description_ru || null,
      description_en: description_en || null,
    })
    .select()
    .single()
  
  if (error) {
    console.error('POST: Supabase error', error)
    return new Response(JSON.stringify({ error: error.message, code: error.code, details: error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  })
}

// PATCH - Update a category
export async function PATCH(req: NextRequest) {
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  let body: any
  try {
    body = await req.json()
  } catch (e) {
    console.error('PATCH: Bad JSON', e)
    return new Response('Bad JSON', { status: 400 })
  }
  
  const { id, ...updates } = body || {}
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }
  
  // Convert empty strings to null for optional fields
  Object.keys(updates).forEach(key => {
    if (updates[key] === '') updates[key] = null
  })
  
  const { data, error } = await supabase
    .from('gallery_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    console.error('PATCH: Supabase error', error)
    return new Response(JSON.stringify({ error: error.message, code: error.code, details: error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

// DELETE - Delete a category
export async function DELETE(req: NextRequest) {
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }
  
  const { error } = await supabase
    .from('gallery_categories')
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('DELETE: Supabase error', error)
    return new Response(JSON.stringify(error), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  return new Response('OK', { status: 200 })
}


