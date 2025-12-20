import { useEffect, useState } from 'react'
import type { Deal } from '../deal-types'
import { fetchDeals } from '../deal-api'

interface UseDealsParams {
  adminToken: string
  isJWT?: boolean
  searchQuery?: string
  stageFilter?: string
  projectTypeFilter?: string
  page?: number
  limit?: number
}

export function useDeals({
  adminToken,
  isJWT = false,
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
    // Don't load if adminToken is not provided or is empty
    if (!adminToken || adminToken.trim() === '') {
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
        adminToken,
        isJWT
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
    // Only load if adminToken is provided and not empty
    if (adminToken && adminToken.trim() !== '') {
      load()
    }
  }, [adminToken, isJWT, searchQuery, stageFilter, projectTypeFilter, page, limit])

  return {
    deals,
    loading,
    error,
    reload: load
  }
}

