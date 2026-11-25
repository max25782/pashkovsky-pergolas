import type { SupabaseClient } from '@supabase/supabase-js'
import { consumeStorageBytes, STORAGE_QUOTA_EXCEEDED } from '@/lib/storage/quota'

export const DEAL_FILES_BUCKET = 'deal-files'
const PREFIX = 'configurator-previews'
const MAX_BYTES = 8 * 1024 * 1024
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7

export type ScreenshotUploadResult =
  | { ok: true; signedUrl: string; storagePath: string }
  | { ok: false; reason: 'invalid' | 'too_large' | 'quota' | 'upload_failed' }

export function dataUrlPngToBuffer(dataUrl: string): Buffer | null {
  if (!dataUrl.startsWith('data:image/png')) return null
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim())
  if (!match) return null
  try {
    return Buffer.from(match[1], 'base64')
  } catch {
    return null
  }
}

export async function uploadConfiguratorScreenshot(
  supabase: SupabaseClient,
  companyId: string,
  offerId: string,
  dataUrl: string,
): Promise<ScreenshotUploadResult> {
  const buf = dataUrlPngToBuffer(dataUrl)
  if (!buf || buf.length < 100) return { ok: false, reason: 'invalid' }
  if (buf.length > MAX_BYTES) return { ok: false, reason: 'too_large' }
  if (!companyId || !offerId) return { ok: false, reason: 'invalid' }

  const quota = await consumeStorageBytes(supabase, companyId, buf.length)
  if (!quota.ok) return { ok: false, reason: 'quota' }

  const storagePath = `${companyId}/${PREFIX}/${offerId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`
  const { error } = await supabase.storage.from(DEAL_FILES_BUCKET).upload(storagePath, buf, {
    contentType: 'image/png',
    upsert: false,
  })
  if (error) {
    console.error('[uploadConfiguratorScreenshot] upload failed')
    await consumeStorageBytes(supabase, companyId, -buf.length)
    return { ok: false, reason: 'upload_failed' }
  }

  const signed = await supabase.storage.from(DEAL_FILES_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS)
  if (signed.error || !signed.data?.signedUrl) {
    await supabase.storage.from(DEAL_FILES_BUCKET).remove([storagePath])
    await consumeStorageBytes(supabase, companyId, -buf.length)
    return { ok: false, reason: 'upload_failed' }
  }

  return { ok: true, signedUrl: signed.data.signedUrl, storagePath }
}

export function screenshotFailureStatus(reason: ScreenshotUploadResult & { ok: false }): {
  status: number
  error: string
} {
  if (reason.reason === 'quota') return { status: 413, error: STORAGE_QUOTA_EXCEEDED }
  if (reason.reason === 'too_large') return { status: 413, error: 'Screenshot is too large' }
  if (reason.reason === 'invalid') return { status: 400, error: 'Invalid screenshot' }
  return { status: 500, error: 'Failed to upload screenshot' }
}
