/**
 * GET /api/media/s3/list
 * List S3 objects under a prefix (paged).
 * Requires admin auth. All S3 credentials stay server-side.
 *
 * Query params:
 *   prefix  - S3 prefix to list (default: "images/")
 *   token   - continuation token for pagination
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { listS3Objects } from '@/lib/s3-upload'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const { searchParams } = new URL(req.url)
  const prefix = searchParams.get('prefix') ?? 'images/'
  const token = searchParams.get('token') ?? undefined

  // Prevent listing outside images/ prefix for safety
  if (!prefix.startsWith('images/') && prefix !== 'images/') {
    return NextResponse.json({ error: 'Prefix must start with images/' }, { status: 400 })
  }

  try {
    console.log('[Media S3 List] Listing prefix:', prefix)
    const result = await listS3Objects(prefix, token)
    console.log('[Media S3 List] Found items:', result.items.length)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Media S3 List] Error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Failed to list S3 objects' },
      { status: 500 },
    )
  }
}
