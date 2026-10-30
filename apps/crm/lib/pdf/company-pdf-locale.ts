import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePdfLocale, type PdfLocale } from '@/lib/pdf/pdf-locale'

/** PDF language is the company setting. A request query does not override it. */
export function mergeUiPdfLocale(
  _requestLocaleRaw: string | null | undefined,
  companyLocale: PdfLocale,
): PdfLocale {
  return companyLocale
}

export function pdfLocaleFromCompanySettings(settings: unknown): PdfLocale | null {
  if (!settings || typeof settings !== 'object') return null
  const record = settings as Record<string, unknown>
  const raw = record.language ?? record.locale ?? record.company_locale ?? record.pdf_locale
  if (typeof raw !== 'string' || raw.trim() === '') return null
  return resolvePdfLocale(raw)
}

/**
 * Reads the organization language from `companies.settings`.
 * Missing row or missing language is Hebrew.
 */
export async function fetchCompanyPdfLocale(
  supabase: SupabaseClient,
  companyId: string,
): Promise<PdfLocale> {
  const { data, error } = await supabase.from('companies').select('settings').eq('id', companyId).single()
  if (error || !data) return 'he'
  return pdfLocaleFromCompanySettings(data.settings) ?? 'he'
}

/** Resolves PDF locale from the offer's `company_id` (defaults to Hebrew). */
export async function fetchPdfLocaleForOffer(
  supabase: SupabaseClient,
  offerId: string,
): Promise<PdfLocale> {
  const { data, error } = await supabase.from('offers').select('company_id').eq('id', offerId).single()
  if (error || !data?.company_id || typeof data.company_id !== 'string') return 'he'
  return fetchCompanyPdfLocale(supabase, data.company_id)
}
