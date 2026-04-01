import type { SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function siteBase(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
  return u || 'http://localhost:3000'
}

export async function mintConfiguratorLinkForOffer(
  supabase: SupabaseClient,
  offerId: string,
  locale: string,
): Promise<{ token: string; tokenRowId: string; editUrl: string; customerUrl: string }> {
  const token = randomBytes(24).toString('base64url')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 14)

  const { data: tok, error: insErr } = await supabase
    .from('configurator_link_tokens')
    .insert({
      offer_id: offerId,
      token,
      expires_at: expiresAt.toISOString(),
      locale,
    })
    .select('id')
    .single()

  if (insErr || !tok) {
    throw new Error(insErr?.message || 'Failed to create configurator token')
  }

  const base = siteBase()
  const loc = locale || 'he'
  const editUrl = `${base}/${loc}/pergola3d?ct=${encodeURIComponent(token)}`
  const customerUrl = `${editUrl}&view=1`

  return {
    token,
    tokenRowId: tok.id as string,
    editUrl,
    customerUrl,
  }
}
