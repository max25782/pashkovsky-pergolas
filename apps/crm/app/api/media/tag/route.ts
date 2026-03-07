/**
 * POST /api/media/tag
 * Upsert tags (and optional caption) for an S3 key in media_assets.
 * Creates the row if it doesn't exist yet (import from S3 flow).
 * Requires admin auth. Enforces company isolation via company_id.
 *
 * Body: { key: string; tags: string[]; caption?: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME ?? ''

export const dynamic = 'force-dynamic'

// Valid AI tags — same list as MediaTagging.md and TagSelector component
const VALID_TAGS = new Set([
  'פרגולה קלאסית',
  'פרגולה היי-טק',
  'פרגולה למטבח חוץ',
  'פרגולה ביוקלמטיק',
  'פרגולה pvc',
  'פרגולה תלויה',
  'פרגולה דמוי עץ',
  'פרגולה יוקרה עם כיסוי זכוכית',
])

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found in session' }, { status: 400 })
  }

  let body: { key?: string; tags?: string[]; caption?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { key, tags, caption } = body

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }
  if (!Array.isArray(tags)) {
    return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
  }

  // Filter to only known valid tags (ignore unknown ones silently)
  const validatedTags = tags.filter((t) => VALID_TAGS.has(t))

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    const { data, error } = await supabase
      .from('media_assets')
      .upsert(
        {
          company_id: companyId,
          s3_bucket: S3_BUCKET,
          s3_key: key,
          tags: validatedTags,
          caption: caption ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'company_id,s3_key' },
      )
      .select('id, s3_key, tags, caption')
      .single()

    if (error) {
      console.error('[Media Tag] Supabase upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, asset: data })
  } catch (error: unknown) {
    console.error('[Media Tag] Error:', error)
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) ?? 'Failed to save tags' },
      { status: 500 },
    )
  }
}
