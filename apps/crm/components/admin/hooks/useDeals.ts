import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Deal } from '../deal-types'

interface UseDealsParams {
  searchQuery?: string
  stageFilter?: string
  projectTypeFilter?: string
  page?: number
  limit?: number
}

export function useDeals({
  searchQuery = '',
  stageFilter = '',
  projectTypeFilter = '',
  page = 0,
  limit = 500
}: UseDealsParams = {}) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    
    try {
      const supabase = createClient()
      
      // Start with base query (include deal_railings_details for railings work type)
      let query = supabase
        .from('deals')
        .select('*, deal_railings_details(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
      
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
  }, [searchQuery, stageFilter, projectTypeFilter, page, limit])

  return {
    deals,
    totalCount,
    loading,
    error,
    reload: load
  }
}
