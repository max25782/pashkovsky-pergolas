import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeVatPercent } from '@/lib/deals/deal-finance'

/**
 * The company's VAT rate: company_settings.vat_percent, the same setting the
 * offers use. A company that never saved one gets the default (18); an
 * unreadable setting is an error, never a silent fallback.
 */
export async function loadCompanyVatPercent(
  supabase: SupabaseClient,
  companyId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('vat_percent')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to load company VAT rate: ${error.message}`)
  return normalizeVatPercent(data?.vat_percent as number | string | null | undefined)
}
