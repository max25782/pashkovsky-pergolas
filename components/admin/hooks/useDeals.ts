import { useEffect, useState } from 'react'
import type { Deal } from '../deal-types'
import { fetchDeals } from '../deal-api'

interface UseDealsParams {
  adminToken: string
  searchQuery?: string
  stageFilter?: string
  projectTypeFilter?: string
  page?: number
  limit?: number
}

export function useDeals({
  adminToken,
  searchQuery = '',
  stageFilter = '',
  projectTypeFilter = '',
  page = 0,
  limit = 100
}: UseDealsParams) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    // Don't load if adminToken is not provided
    if (!adminToken) {
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDeals(
        {
          q: searchQuery,
          stage: stageFilter,
          project_type: projectTypeFilter,
          limit,
          offset: page * limit
        },
        adminToken
      )
      setDeals(result.data)
    } catch (e: any) {
      console.error('Load error:', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only load if adminToken is provided
    if (adminToken) {
      load()
    }
  }, [adminToken, searchQuery, stageFilter, projectTypeFilter, page, limit])

  return {
    deals,
    loading,
    error,
    reload: load
  }
}

