import { useEffect, useState } from 'react'
import type { Lead } from '../lead-types'
import { fetchLeads } from '../lead-api'

interface UseLeadsParams {
  adminToken: string
  searchQuery?: string
  page?: number
  limit?: number
}

export function useLeads({
  adminToken,
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
      const data = await fetchLeads(
        {
          q: searchQuery,
          limit,
          offset: page * limit
        },
        adminToken
      )
      setLeads(data)
    } catch (e: any) {
      console.error('Load error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [adminToken, searchQuery, page, limit])

  return {
    leads,
    loading,
    error,
    reload: load
  }
}

