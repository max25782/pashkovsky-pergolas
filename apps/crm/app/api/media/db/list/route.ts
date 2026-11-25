/**
 * GET /api/media/db/list?prefix=images/
 * Returns media_assets for the current company under images/{companyId}/.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { resolveCompanyMediaPrefix } from '@/lib/gallery/company-scope'

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

  const scoped = resolveCompanyMediaPrefix(
    companyId,
    req.nextUrl.searchParams.get('prefix'),
  )
  if ('error' in scoped) return scoped.error

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data, error } = await supabase
    .from('media_assets')
    .select('s3_key, tags, caption, category')
    .eq('company_id', companyId)
    .like('s3_key', `${scoped.prefix}%`)
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[Media DB List] Supabase error:', error)
    return NextResponse.json({ error: 'Failed to list media assets' }, { status: 500 })
  }

  return NextResponse.json({ assets: data ?? [] })
}
