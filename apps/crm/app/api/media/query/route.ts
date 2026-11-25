/**
 * POST /api/media/query
 * Query media_assets by catalog category and/or legacy tags for a company, returning presigned GET URLs.
 * Prefer `category` (pergolas | railings | fences | laundry_covers); tags are optional/legacy.
 *
 * Body: { category?: string; tags?: string[]; limit?: number; prefix?: string; random?: boolean }
 * Provide at least one of `category` or `tags`.
 * Response: { items: Array<{ key, tags, caption, category, url }> }
 *
 * Auth: the caller's company comes from the verified session. There is no default company.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { presignGetObject } from '@/lib/s3-upload'
import { isValidCatalogCategory } from '@/lib/media/catalog-categories'
import { companyGalleryPrefix } from '@/lib/gallery/company-scope'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const dynamic = 'force-dynamic'

export interface MediaQueryItem {
  key: string
  tags: string[]
  caption: string | null
  category: string | null
  url: string
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error
  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  let body: {
    category?: string
    tags?: string[]
    limit?: number
    prefix?: string
    random?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { category, tags = [], limit = 3, prefix, random = true } = body

  const hasCategory =
    typeof category === 'string' && category.trim() !== '' && isValidCatalogCategory(category)
  const hasTags = Array.isArray(tags) && tags.length > 0

  if (!hasCategory && !hasTags) {
    return NextResponse.json(
      { error: 'Provide a valid category or a non-empty tags array' },
      { status: 400 },
    )
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    let query = supabase
      .from('media_assets')
      .select('s3_key, tags, caption, category')
      .eq('company_id', companyId)

    if (hasCategory) {
      query = query.eq('category', category)
    }
    if (hasTags) {
      query = query.contains('tags', tags)
    }

    // Optional S3 prefix filter (e.g. "images/pergulot/")
    if (prefix) {
      if (!prefix.startsWith(companyGalleryPrefix(companyId))) {
        return NextResponse.json({ error: 'Prefix is outside your company media root' }, { status: 403 })
      }
      query = query.like('s3_key', `${prefix}%`)
    } else {
      query = query.like('s3_key', `${companyGalleryPrefix(companyId)}%`)
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
        return {
          key: row.s3_key,
          tags: row.tags ?? [],
          caption: row.caption,
          category: row.category ?? null,
          url,
        }
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
