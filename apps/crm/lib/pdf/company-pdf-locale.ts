import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultPdfLocaleForCompany } from '@/lib/company-default-language'
import { resolvePdfLocale, type PdfLocale } from '@/lib/pdf/pdf-locale'

/** Prefer `?locale=` from the CRM UI; otherwise company settings (`fetchCompanyPdfLocale`). */
export function mergeUiPdfLocale(
  requestLocaleRaw: string | null | undefined,
  companyLocale: PdfLocale,
): PdfLocale {
  const t = requestLocaleRaw?.trim()
  if (t) return resolvePdfLocale(t)
  return companyLocale
}

/**
 * Reads tenant PDF/UI language from `companies.settings` JSONB.
 * Supports: settings.locale | settings.company_locale | settings.pdf_locale
 */
export async function fetchCompanyPdfLocale(
  supabase: SupabaseClient,
  companyId: string,
): Promise<PdfLocale> {
  const { data, error } = await supabase.from('companies').select('name, settings').eq('id', companyId).single()
  const row = data as { name?: string | null; settings?: unknown } | null
  const tenantFallback = defaultPdfLocaleForCompany(row?.name ?? null)

  if (error || !data) {
    return tenantFallback
  }

  if (!data.settings || typeof data.settings !== 'object') {
    return tenantFallback
  }
  const settings = data.settings as Record<string, unknown>
  const raw = settings.locale ?? settings.company_locale ?? settings.pdf_locale
  if (typeof raw === 'string' && raw.trim() !== '') {
    return resolvePdfLocale(raw)
  }
  return tenantFallback
}

/** Resolves PDF locale from the offer's `company_id` (defaults to Hebrew). */
export async function fetchPdfLocaleForOffer(
  supabase: SupabaseClient,
  offerId: string,
): Promise<PdfLocale> {
  const { data, error } = await supabase.from('offers').select('company_id').eq('id', offerId).single()
  if (error || !data?.company_id || typeof data.company_id !== 'string') return 'en'
  return fetchCompanyPdfLocale(supabase, data.company_id)
}
