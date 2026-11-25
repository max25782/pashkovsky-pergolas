import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePublicCompanyId } from '@/lib/gallery/company-scope'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

/** Public list: published projects of one company. company_id is required. */
export async function GET(req: NextRequest) {
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const scoped = parsePublicCompanyId(req.nextUrl.searchParams)
  if ('error' in scoped) return scoped.error

  const { data, error } = await supabase
    .from('pergola_projects')
    .select('id, title_he, title_ru, title_en, desc_he, desc_ru, desc_en, images, created_at, company_id')
    .eq('company_id', scoped.companyId)
    .eq('published', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET /api/pergola-projects error', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }

  return NextResponse.json({ projects: data || [] })
}
