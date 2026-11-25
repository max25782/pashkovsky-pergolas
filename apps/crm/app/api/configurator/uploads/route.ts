import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { consumeStorageBytes, STORAGE_QUOTA_EXCEEDED } from '@/lib/storage/quota'
import {
  CONFIGURATOR_MAX_BYTES,
  CONFIGURATOR_UPLOAD_RATE,
  configuratorObjectPath,
  isConfiguratorBucket,
  isConfiguratorMime,
} from '@/lib/configurator/upload-limits'

export const runtime = 'nodejs'

const SIGNED_URL_SECONDS = 60 * 60

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Authenticated upload into configurator-photos or configurator-results.
 * Anonymous callers are rejected. The browser never writes to Storage directly.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error

  const companyId = auth.context.companyId
  if (!companyId) {
    return NextResponse.json({ error: 'Company ID not found' }, { status: 400 })
  }

  const ip = getClientIp(req)
  const limit = await checkRateLimit(`configurator-upload:${companyId}:${ip}`, CONFIGURATOR_UPLOAD_RATE)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many uploads' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
    )
  }

  const supabase = serviceClient()
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a file upload' }, { status: 400 })
  }

  const bucketRaw = form.get('bucket')
  const file = form.get('file')
  if (typeof bucketRaw !== 'string' || !isConfiguratorBucket(bucketRaw)) {
    return NextResponse.json({ error: 'bucket must be configurator-photos or configurator-results' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }
  if (!isConfiguratorMime(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }
  if (file.size <= 0 || file.size > CONFIGURATOR_MAX_BYTES) {
    return NextResponse.json({ error: 'File is empty or larger than 10 MB' }, { status: 413 })
  }

  const quota = await consumeStorageBytes(supabase, companyId, file.size)
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.error ?? STORAGE_QUOTA_EXCEEDED, used_mb: quota.usedMb, limit_mb: quota.limitMb },
      { status: 413 },
    )
  }

  const path = configuratorObjectPath(companyId, bucketRaw, file.type)
  if (!path.startsWith(`${companyId}/`)) {
    return NextResponse.json({ error: 'Invalid storage path' }, { status: 500 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const uploaded = await supabase.storage.from(bucketRaw).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (uploaded.error) {
    await consumeStorageBytes(supabase, companyId, -file.size)
    console.error('[configurator/uploads] upload failed')
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const signed = await supabase.storage.from(bucketRaw).createSignedUrl(path, SIGNED_URL_SECONDS)
  if (signed.error || !signed.data?.signedUrl) {
    await supabase.storage.from(bucketRaw).remove([path])
    await consumeStorageBytes(supabase, companyId, -file.size)
    return NextResponse.json({ error: 'Could not sign the uploaded file' }, { status: 500 })
  }

  return NextResponse.json({
    path,
    bucket: bucketRaw,
    signedUrl: signed.data.signedUrl,
  })
}
