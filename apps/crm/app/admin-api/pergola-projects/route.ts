import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET (admin) - list all projects
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { data, error } = await supabase
    .from('pergola_projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET pergola_projects error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ projects: data || [] })
}

// POST (admin) - create project
export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  try {
    const body = await req.json()
    const {
      title_he,
      title_ru,
      title_en,
      desc_he,
      desc_ru,
      desc_en,
      images,
    } = body || {}

    if (!title_he) {
      return NextResponse.json({ error: 'title_he is required' }, { status: 400 })
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'images[] is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('pergola_projects')
      .insert({
        title_he,
        title_ru: title_ru || null,
        title_en: title_en || null,
        desc_he: desc_he || null,
        desc_ru: desc_ru || null,
        desc_en: desc_en || null,
        images,
      })
      .select()
      .single()

    if (error) {
      console.error('POST pergola_projects error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ project: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bad request' }, { status: 400 })
  }
}

// DELETE (admin) - delete by id
export async function DELETE(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('pergola_projects')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('DELETE pergola_projects error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}




