import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Deal } from '../deal-types'

/** 'board' = saved deals (default); 'quick' = unsaved quick offers (source='quick_offer'). */
export type DealsScope = 'board' | 'quick'

interface UseDealsParams {
  scope?: DealsScope
  searchQuery?: string
  stageFilter?: string
  projectTypeFilter?: string
  page?: number
  limit?: number
}

async function getCompanyId(): Promise<string | null> {
  try {
    const res = await fetch('/api/companies/me')
    if (!res.ok) return null
    const data = await res.json()
    return data.company_id ?? null
  } catch {
    return null
  }
}

export function useDeals({
  scope = 'board',
  searchQuery = '',
  stageFilter = '',
  projectTypeFilter = '',
  page = 0,
  limit = 500
}: UseDealsParams = {}) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  // How many unsaved quick offers exist (badge on the "quick offers" tab).
  const [quickOfferCount, setQuickOfferCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()

      const companyId = await getCompanyId()
      if (!companyId) {
        setDeals([])
        setTotalCount(0)
        return
      }
      
      // Start with base query (include deal_railings_details for railings work type)
      // The main board excludes unsaved quick offers — they join it once save-to-crm sets
      // source='quick_offer_saved'. Must use .or() because .neq() also excludes rows where
      // source IS NULL. The 'quick' scope shows exactly those hidden quick offers instead.
      const base = supabase
        .from('deals')
        .select('*, deal_railings_details(*)', { count: 'exact' })
        .eq('company_id', companyId)
      let query = (
        scope === 'quick'
          ? base.eq('source', 'quick_offer')
          : base.or('source.is.null,source.neq.quick_offer')
      ).order('created_at', { ascending: false })

      const { count: hiddenCount, error: hiddenError } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('source', 'quick_offer')
      if (hiddenError) {
        console.error('[useDeals] Quick offer count error:', hiddenError.message)
      } else {
        setQuickOfferCount(hiddenCount ?? 0)
      }
      
      // Apply filters
      if (stageFilter) {
        query = query.eq('stage', stageFilter)
      }
      
      if (projectTypeFilter) {
        query = query.eq('project_type', projectTypeFilter)
      }
      
      // Apply search (customer_name, customer_phone, project_address, notes)
      if (searchQuery) {
        const like = `%${searchQuery.replace(/\s+/g, '%')}%`
        query = query.or(
          `customer_name.ilike.${like},customer_phone.ilike.${like},project_address.ilike.${like},notes.ilike.${like},customer_city.ilike.${like}`
        )
      }
      
      // Apply pagination
      const offset = page * limit
      query = query.range(offset, offset + limit - 1)
      
      const { data, error: queryError, count } = await query
      
      if (queryError) {
        throw new Error(queryError.message)
      }
      
      setDeals(data || [])
      setTotalCount(count ?? null)
    } catch (e: unknown) {
      console.error('[useDeals] Load error:', e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [scope, searchQuery, stageFilter, projectTypeFilter, page, limit])

  return {
    deals,
    totalCount,
    quickOfferCount,
    loading,
    error,
    reload: load
  }
}
