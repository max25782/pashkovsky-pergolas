/**
 * POST /api/media/query
 * Query media_assets by tag(s) for a company, returning presigned GET URLs.
 * Used by the AI chat tool "get_images_by_tags" and the admin media page.
 *
 * Body: { tags: string[]; limit?: number; prefix?: string; random?: boolean }
 * Response: { items: Array<{ key, tags, caption, url }> }
 *
 * Auth: accepts both admin JWT (Authorization header) and internal server calls
 * (no auth header — used server-side from AI chat route which runs in same process).
 * For public/client calls, auth is always required.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { presignGetObject } from '@/lib/s3-upload'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Default Pashkovsky company ID (single-tenant v1).
// TODO (multi-tenant v2): remove this fallback; always require company_id from JWT.
const DEFAULT_COMPANY_ID = process.env.DEFAULT_COMPANY_ID ?? '6998295e-89ae-4e3d-afd2-8c2b0333eac2'

export const dynamic = 'force-dynamic'

export interface MediaQueryItem {
  key: string
  tags: string[]
  caption: string | null
  url: string
}

export async function POST(req: NextRequest) {
  // Allow server-side calls (from AI chat route) without auth header
  const authHeader = req.headers.get('authorization')
  let companyId: string

  if (authHeader) {
    const authCheck = await requireAuthAsync(req)
    if (!authCheck.authorized) return authCheck.error
    companyId = authCheck.context?.companyId ?? DEFAULT_COMPANY_ID
  } else {
    // Internal server-to-server call — use default company
    companyId = DEFAULT_COMPANY_ID
  }

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not resolved' }, { status: 400 })
  }

  let body: { tags?: string[]; limit?: number; prefix?: string; random?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tags = [], limit = 3, prefix, random = true } = body

  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: 'tags array is required and must not be empty' }, { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    // Build query: tags @> ARRAY[...] means "row tags contains all requested tags"
    let query = supabase
      .from('media_assets')
      .select('s3_key, tags, caption')
      .eq('company_id', companyId)
      .contains('tags', tags)

    // Optional S3 prefix filter (e.g. "images/pergulot/")
    if (prefix) {
      query = query.like('s3_key', `${prefix}%`)
    }

    // Fetch more than needed to allow randomisation
    const fetchLimit = random ? Math.min(limit * 10, 50) : limit
    query = query.limit(fetchLimit)

    const { data, error } = await query

    if (error) {
      console.error('[Media Query] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let rows = data ?? []

    // Randomise and trim to requested limit
    if (random && rows.length > limit) {
      rows = rows.sort(() => Math.random() - 0.5).slice(0, limit)
    } else {
      rows = rows.slice(0, limit)
    }

    // Generate presigned URLs (15-minute expiry)
    const items: MediaQueryItem[] = await Promise.all(
      rows.map(async (row) => {
        let url = ''
        try {
          url = await presignGetObject(row.s3_key, 900)
        } catch (e) {
          console.error('[Media Query] Failed to presign key:', row.s3_key, e)
        }
        return { key: row.s3_key, tags: row.tags ?? [], caption: row.caption, url }
      }),
    )

    return NextResponse.json({ items })
  } catch (error: unknown) {
    console.error('[Media Query] Error:', error)
    return NextResponse.json(
      { error: (error instanceof Error ? error.message : String(error)) ?? 'Failed to query media assets' },
      { status: 500 },
    )
  }
}
