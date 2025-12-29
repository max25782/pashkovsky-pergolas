import { useEffect, useState } from 'react'
import type { Lead } from '../lead-types'
import { createAuthenticatedClient } from '@/lib/supabase/client'

interface UseLeadsParams {
  searchQuery?: string
  page?: number
  limit?: number
}

export function useLeads({
  searchQuery = '',
  page = 0,
  limit = 20
}: UseLeadsParams) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // Create authenticated client with JWT token
      const supabase = createAuthenticatedClient()
      
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1)
      
      // Search filter
      if (searchQuery && searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
      }
      
      const { data, error: dbError } = await query
      
      if (dbError) {
        console.error('[useLeads] DB error:', dbError)
        setError(dbError.message)
        return
      }
      
      setLeads(data || [])
    } catch (e: any) {
      console.error('[useLeads] Error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [searchQuery, page, limit]) // removed adminToken

  return {
    leads,
    loading,
    error,
    reload: load
  }
}

