import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'deal-files'
const PREFIX = 'configurator-previews'

export function dataUrlPngToBuffer(dataUrl: string): Buffer | null {
  if (!dataUrl.startsWith('data:image/')) return null
  const m = /^data:image\/png;base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  try {
    return Buffer.from(m[1], 'base64')
  } catch {
    return null
  }
}

export async function uploadConfiguratorScreenshot(
  supabase: SupabaseClient,
  offerId: string,
  dataUrl: string
): Promise<string | null> {
  const buf = dataUrlPngToBuffer(dataUrl)
  if (!buf || buf.length < 100) return null

  const key = `${PREFIX}/${offerId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`
  const { error } = await supabase.storage.from(BUCKET).upload(key, buf, {
    contentType: 'image/png',
    upsert: false,
  })
  if (error) {
    console.error('[uploadConfiguratorScreenshot]', error)
    return null
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(key)
  return data.publicUrl
}
