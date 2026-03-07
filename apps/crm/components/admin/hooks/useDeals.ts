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
  limit = 100
}: UseDealsParams = {}) {
  const [deals, setDeals] = useState<Deal[]>([])
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
        .select('*, deal_railings_details(*)')
        .order('created_at', { ascending: false })
      
      // Apply filters
      if (stageFilter) {
        query = query.eq('stage', stageFilter)
      }
      
      if (projectTypeFilter) {
        query = query.eq('project_type', projectTypeFilter)
      }
      
      // Apply search (search in client_name and address)
      if (searchQuery) {
        query = query.or(`client_name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`)
      }
      
      // Apply pagination
      const offset = page * limit
      query = query.range(offset, offset + limit - 1)
      
      const { data, error: queryError } = await query
      
      if (queryError) {
        throw new Error(queryError.message)
      }
      
      setDeals(data || [])
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
    loading,
    error,
    reload: load
  }
}
