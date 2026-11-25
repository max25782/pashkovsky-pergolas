import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSiteCompanyId } from '@/lib/site-company'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Published projects for one company. Query company_id overrides the site tenant. */
export async function GET(req: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const requested = req.nextUrl.searchParams.get('company_id')
  const companyId = requested && UUID_RE.test(requested) ? requested : getSiteCompanyId()
  if (!companyId) {
    return NextResponse.json({ projects: [] })
  }

  try {
    const { data, error } = await supabase
      .from('pergola_projects')
      .select('id, title_he, title_ru, title_en, desc_he, desc_ru, desc_en, images, created_at')
      .eq('company_id', companyId)
      .eq('published', true)
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
