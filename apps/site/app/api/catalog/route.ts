import { NextRequest, NextResponse } from 'next/server'
import { fetchCatalogPayload } from '@/lib/catalog/get-catalog-data'
import { isS3PresignConfigured } from '@/lib/s3-presign'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/catalog
 * Query: sections=pergola_classic,pergola_glass,... (optional, comma-separated section ids)
 * Returns grouped catalog JSON with short-lived presigned image URLs.
 * Data source: S3 list under CATALOG_S3_PREFIX; path rules in lib/catalog/catalog-config.ts (not tags/DB).
 */
export async function GET(req: NextRequest) {
  try {
    if (!isS3PresignConfigured()) {
      return NextResponse.json(
        { error: 'Catalog API not configured (S3 credentials).' },
        { status: 503 },
      )
    }

    const sections = req.nextUrl.searchParams.get('sections')
    const payload = await fetchCatalogPayload({ sections })
    return NextResponse.json(payload)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Catalog fetch failed'
    console.error('[api/catalog]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
