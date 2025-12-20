import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// Public GET: list projects (no auth)
export async function GET(req: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const { data, error } = await supabase
    .from('pergola_projects')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/pergola-projects error', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }

  return NextResponse.json({ projects: data || [] })
}





