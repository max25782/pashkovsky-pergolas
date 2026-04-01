/**
 * POST /api/media/tag
 * Upsert caption and optional catalog category for an S3 key in media_assets.
 * Tags are not used (column kept for schema compatibility; always stored empty).
 * Creates the row if it doesn't exist yet (import from S3 flow).
 * Requires admin auth. Enforces company isolation via company_id.
 *
 * Body: { key: string; caption?: string; category?: string | null }
 * Valid category: pergolas | railings | fences | laundry_covers
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { isValidCatalogCategory } from '@/lib/media/catalog-categories'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME ?? ''

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found in session' }, { status: 400 })
  }

  let body: { key?: string; caption?: string; category?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { key, caption, category } = body

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const upsertPayload: Record<string, unknown> = {
    company_id: companyId,
    s3_bucket: S3_BUCKET,
    s3_key: key,
    tags: [],
    caption: caption ?? null,
    updated_at: new Date().toISOString(),
  }
  if ('category' in body) {
    if (category === null || category === '') {
      upsertPayload.category = null
    } else if (typeof category === 'string' && isValidCatalogCategory(category)) {
      upsertPayload.category = category
    } else {
      upsertPayload.category = null
    }
  }

  try {
    const { data, error } = await supabase
      .from('media_assets')
      .upsert(upsertPayload, { onConflict: 'company_id,s3_key' })
      .select('id, s3_key, tags, caption, category')
      .single()

    if (error) {
      console.error('[Media Tag] Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, asset: data })
  } catch (error: unknown) {
    console.error('[Media Tag] Error:', error)
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) ?? 'Failed to save asset' },
      { status: 500 },
    )
  }
}
