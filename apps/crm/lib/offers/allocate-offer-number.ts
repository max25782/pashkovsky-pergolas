import type { SupabaseClient } from '@supabase/supabase-js'

export function formatAllocatedOfferNumber(year: number, sequence: number): string {
  return `${year}-${String(sequence).padStart(4, '0')}`
}

/**
 * Atomically allocates the next offer number for a company in the given calendar year.
 * Requires migration `050_offers_offer_number.sql` (RPC `allocate_offer_number`).
 */
export async function allocateOfferNumber(
  supabase: SupabaseClient,
  companyId: string,
  year = new Date().getFullYear(),
): Promise<string> {
  const { data, error } = await supabase.rpc('allocate_offer_number', {
    p_company_id: companyId,
    p_year: year,
  })
  if (error || typeof data !== 'string' || data.length === 0) {
    throw new Error(error?.message ?? 'Failed to allocate offer number')
  }
  return data
}
