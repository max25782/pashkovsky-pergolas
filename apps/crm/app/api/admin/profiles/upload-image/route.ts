/**
 * POST /api/admin/profiles/upload-image
 * Accepts a multipart/form-data file upload, stores it in S3 under
 * profiles/<profileCode>/<filename> and returns the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { uploadToS3 } from '@/lib/s3-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const profileCode = (formData.get('code') as string | null)?.trim() || 'unknown'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, AVIF` },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.` },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeCode = profileCode.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    const key = `profiles/${safeCode}/${safeCode}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const url = await uploadToS3(buffer, key, file.type)


    return NextResponse.json({ url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    console.error('[Profile Image Upload] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
