/**
 * Firm identity for generated documents: contact data plus a logo Puppeteer can render.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { EMPTY_FIRM_PROFILE, loadFirmProfile, type FirmProfile } from '@/lib/company/firm-profile'
import { getLogoDataUri } from './font-loader'

export interface PdfBranding {
  firm: FirmProfile
  /** Always renderable: the firm's own logo inlined as a data URI, else the product logo. */
  logoUri: string
}

/** Branding used when no firm is known (previews, scripts). Carries no firm data. */
export function defaultBranding(): PdfBranding {
  return { firm: EMPTY_FIRM_PROFILE, logoUri: getLogoDataUri() }
}

async function inlineLogo(url: string): Promise<string | null> {
  if (url.startsWith('data:image/')) return url
  if (!/^https?:\/\//i.test(url)) return null
  try {
    // Puppeteer renders from about:blank and cannot load remote images itself.
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      console.warn('[firm-branding] logo fetch failed', { status: res.status })
      return null
    }
    const contentType = res.headers.get('content-type') ?? 'image/png'
    if (!contentType.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return `data:${contentType};base64,${buffer.toString('base64')}`
  } catch (error) {
    console.warn('[firm-branding] logo fetch error', error instanceof Error ? error.message : error)
    return null
  }
}

export async function brandingForFirm(firm: FirmProfile): Promise<PdfBranding> {
  const own = firm.logoUrl ? await inlineLogo(firm.logoUrl) : null
  return { firm, logoUri: own ?? getLogoDataUri() }
}

export async function loadBranding(
  supabase: SupabaseClient,
  companyId: string | null | undefined,
): Promise<PdfBranding> {
  return brandingForFirm(await loadFirmProfile(supabase, companyId))
}

export async function loadBrandingForOffer(supabase: SupabaseClient, offerId: string): Promise<PdfBranding> {
  try {
    const { data } = await supabase.from('offers').select('company_id').eq('id', offerId).maybeSingle()
    const companyId = typeof data?.company_id === 'string' ? data.company_id : null
    return await loadBranding(supabase, companyId)
  } catch (error) {
    console.error('[firm-branding] offer lookup failed', { offerId, error: error instanceof Error ? error.message : error })
    return defaultBranding()
  }
}
