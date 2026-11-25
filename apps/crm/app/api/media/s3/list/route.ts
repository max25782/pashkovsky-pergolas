/**
 * GET /api/media/s3/list
 * List S3 objects under the caller's company media root images/{companyId}/.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { listS3Objects } from '@/lib/s3-upload'
import { resolveCompanyMediaPrefix } from '@/lib/gallery/company-scope'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const requested = searchParams.get('prefix')
  const token = searchParams.get('token') ?? undefined

  const scoped = resolveCompanyMediaPrefix(companyId, requested)
  if ('error' in scoped) return scoped.error

  try {
    const result = await listS3Objects(scoped.prefix, token)
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('[Media S3 List] Error:', error)
    return NextResponse.json({ error: 'Failed to list S3 objects' }, { status: 500 })
  }
}
