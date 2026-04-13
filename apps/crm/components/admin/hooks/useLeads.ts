import { useEffect, useState } from 'react'
import type { Lead } from '../lead-types'
import { createClient } from '@/lib/supabase/client'

interface UseLeadsParams {
  searchQuery?: string
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
      const supabase = createClient()

      const companyId = await getCompanyId()
      if (!companyId) {
        setLeads([])
        return
      }

      let query = supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1)
      
      // Search filter (name, phone, email, city)
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim()
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,city.ilike.%${q}%`)
      }
      
      const { data, error: dbError } = await query
      
      if (dbError) {
        console.error('[useLeads] DB error:', dbError)
        setError(dbError.message)
        return
      }
      
      setLeads(data || [])
    } catch (e: unknown) {
      console.error('[useLeads] Error:', e)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [searchQuery, page, limit])

  return {
    leads,
    loading,
    error,
    reload: load
  }
}

