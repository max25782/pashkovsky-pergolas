import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getSupabaseUrlForServiceRole } from '@/lib/supabase-admin-url'

const SUPABASE_URL = getSupabaseUrlForServiceRole()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function requireCompanyId(authCheck: { context?: { companyId?: string } }) {
  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return { error: new Response(JSON.stringify({ error: 'Company ID not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }) }
  }
  return { companyId }
}

// GET - List categories for the caller's company
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const scoped = requireCompanyId(authCheck)
  if ('error' in scoped) return scoped.error

  const { data, error } = await supabase
    .from('gallery_categories')
    .select('*')
    .eq('company_id', scoped.companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET gallery categories error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch categories' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ data: data ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// POST - Create a new category for the caller's company
export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const scoped = requireCompanyId(authCheck)
  if ('error' in scoped) return scoped.error

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const { key, name_he, name_ru, name_en, description_he, description_ru, description_en } = body || {}

  if (!key || typeof key !== 'string') {
    return new Response('Missing required field: key', { status: 400 })
  }

  const { data, error } = await supabase
    .from('gallery_categories')
    .insert({
      company_id: scoped.companyId,
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
    return new Response(JSON.stringify({ error: 'Failed to create category' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

// PATCH - Update a category (company-scoped)
export async function PATCH(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const scoped = requireCompanyId(authCheck)
  if ('error' in scoped) return scoped.error

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const { id, ...updates } = body || {}
  if (!id || typeof id !== 'string') {
    return new Response('Missing id', { status: 400 })
  }

  delete (updates as { company_id?: unknown }).company_id

  Object.keys(updates).forEach((key) => {
    if (updates[key] === '') updates[key] = null
  })

  const { data, error } = await supabase
    .from('gallery_categories')
    .update(updates)
    .eq('id', id)
    .eq('company_id', scoped.companyId)
    .select()
    .maybeSingle()

  if (error) {
    console.error('PATCH: Supabase error', error)
    return new Response(JSON.stringify({ error: 'Failed to update category' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!data) {
    return new Response(JSON.stringify({ error: 'Category not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// DELETE - Delete a category (company-scoped)
export async function DELETE(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const scoped = requireCompanyId(authCheck)
  if ('error' in scoped) return scoped.error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return new Response('Missing id', { status: 400 })
  }

  const { data, error } = await supabase
    .from('gallery_categories')
    .delete()
    .eq('id', id)
    .eq('company_id', scoped.companyId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('DELETE: Supabase error', error)
    return new Response(JSON.stringify({ error: 'Failed to delete category' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!data) {
    return new Response(JSON.stringify({ error: 'Category not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response('OK', { status: 200 })
}
