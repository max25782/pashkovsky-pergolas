import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = SUPABASE_URL && ANON_KEY
  ? createClient(SUPABASE_URL, ANON_KEY, { db: { schema: 'public' } })
  : undefined

// Public GET: list projects (no auth required)
export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { data, error } = await supabase
      .from('pergola_projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('GET /api/pergola-projects error', error)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    return NextResponse.json({ projects: data || [] })
  } catch (error) {
    console.error('[Pergola Projects API] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

