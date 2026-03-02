/**
 * POST /api/media/presign
 * Generate presigned GET URLs for an explicit list of S3 keys.
 * Used by the admin media page to load thumbnails without requiring tags.
 *
 * Body: { keys: string[] }
 * Response: { urls: Record<string, string> }  key → presigned URL
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { presignGetObject } from '@/lib/s3-upload'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  let body: { keys?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { keys = [] } = body
  if (!Array.isArray(keys) || keys.length === 0) {
    return NextResponse.json({ error: 'keys array is required' }, { status: 400 })
  }

  // Cap at 50 keys per request to avoid timeout
  const limited = keys.slice(0, 50)

  const entries = await Promise.all(
    limited.map(async (key) => {
      try {
        const url = await presignGetObject(key, 900)
        return [key, url] as [string, string]
      } catch (e) {
        console.error('[Presign] Failed for key:', key, e)
        return [key, ''] as [string, string]
      }
    }),
  )

  return NextResponse.json({ urls: Object.fromEntries(entries) })
}
