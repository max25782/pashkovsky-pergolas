/**
 * GET /api/media/db/list?prefix=images/
 * Returns all media_assets rows for the current company matching the given S3 key prefix.
 * Used by the admin media page to load saved tags on initial render.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  const prefix = req.nextUrl.searchParams.get('prefix') ?? 'images/'

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data, error } = await supabase
    .from('media_assets')
    .select('s3_key, tags, caption')
    .eq('company_id', companyId)
    .like('s3_key', `${prefix}%`)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[Media DB List] Supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ assets: data ?? [] })
}
