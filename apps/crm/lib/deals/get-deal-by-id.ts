import type { SupabaseClient } from '@supabase/supabase-js'

/** Fields needed for warranty PDF and auth check (aligned with `deals` table). */
export interface DealRecordForPdf {
  id: string
  company_id: string
  customer_name: string | null
  customer_city: string | null
  project_address: string | null
  notes: string | null
  price: number | null
  installation_date: string | null
  work_type: string | null
  project_type: string | null
  project_config: unknown | null
}

export interface CompanyBrandingRow {
  name: string
  settings: Record<string, unknown> | null
}

/**
 * Loads a deal row for PDF generation (no RLS — caller must enforce company access).
 */
export async function getDealById(
  supabase: SupabaseClient,
  dealId: string,
): Promise<{ deal: DealRecordForPdf | null; error?: string }> {
  const { data, error } = await supabase
    .from('deals')
    .select(
      'id, company_id, customer_name, customer_city, project_address, notes, price, installation_date, work_type, project_type, project_config',
    )
    .eq('id', dealId)
    .maybeSingle()

  if (error) {
    return { deal: null, error: error.message }
  }
  if (!data) {
    return { deal: null }
  }
  return { deal: data as DealRecordForPdf }
}

export async function getCompanyBranding(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CompanyBrandingRow | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('name, settings')
    .eq('id', companyId)
    .maybeSingle()

  if (error || !data?.name) return null

  const settings =
    data.settings && typeof data.settings === 'object'
      ? (data.settings as Record<string, unknown>)
      : null

  return { name: String(data.name), settings }
}
