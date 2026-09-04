import { NextRequest, NextResponse } from 'next/server'
import { fetchCatalogPayload } from '@/lib/catalog/get-catalog-data'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/catalog
 * Query: sections=pergola_classic,pergola_glass,... (optional, comma-separated section ids)
 * Returns grouped catalog JSON with public S3 image URLs (same as the rest of the site).
 */
export async function GET(req: NextRequest) {
  try {
    const sections = req.nextUrl.searchParams.get('sections')
    const payload = await fetchCatalogPayload({ sections })
    return NextResponse.json(payload)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Catalog fetch failed'
    console.error('[api/catalog]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
