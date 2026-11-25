import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : null

function companyIdFrom(authCheck: { context?: { companyId?: string } }) {
  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return { error: NextResponse.json({ error: 'Company ID not found' }, { status: 400 }) }
  }
  return { companyId }
}

export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return NextResponse.json({ articles: [] })

  const scoped = companyIdFrom(authCheck)
  if ('error' in scoped) return scoped.error

  try {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('company_id', scoped.companyId)
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42P01') return NextResponse.json({ articles: [] })
      console.error('[Articles API] Error loading:', error)
      throw error
    }

    return NextResponse.json({ articles: data || [] })
  } catch (error) {
    console.error('[Articles API] Error:', error)
    return NextResponse.json({ error: 'Failed to load articles', articles: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const scoped = companyIdFrom(authCheck)
  if ('error' in scoped) return scoped.error

  try {
    const article = await req.json()
    if (!article || typeof article !== 'object') {
      return NextResponse.json({ error: 'Invalid article' }, { status: 400 })
    }

    const payload = { ...(article as Record<string, unknown>) }
    delete payload.company_id

    if (payload.id) {
      const id = payload.id
      delete payload.id
      const { data, error } = await supabase
        .from('articles')
        .update(payload)
        .eq('id', id)
        .eq('company_id', scoped.companyId)
        .select()
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      return NextResponse.json({ success: true, article: data })
    }

    const { data, error } = await supabase
      .from('articles')
      .insert({ ...payload, company_id: scoped.companyId })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, article: data })
  } catch (error) {
    console.error('[Articles API] Save error:', error)
    return NextResponse.json({ error: 'Failed to save article' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const scoped = companyIdFrom(authCheck)
  if ('error' in scoped) return scoped.error

  try {
    const slug = new URL(req.url).searchParams.get('slug')
    if (!slug) return NextResponse.json({ error: 'Slug is required' }, { status: 400 })

    const { data, error } = await supabase
      .from('articles')
      .delete()
      .eq('slug', slug)
      .eq('company_id', scoped.companyId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Articles API] Delete error:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
