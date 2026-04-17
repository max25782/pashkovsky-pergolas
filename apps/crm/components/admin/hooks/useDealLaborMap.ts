'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'

export function useDealLaborMap(dealIds: string[]): Record<string, number> {
  const [map, setMap] = useState<Record<string, number>>({})

  useEffect(() => {
    if (dealIds.length === 0) {
      setMap({})
      return
    }

    let cancelled = false
    const fetchAll = async () => {
      const result: Record<string, number> = {}
      const batch = dealIds.slice(0, 50)
      await Promise.all(
        batch.map(async (id) => {
          if (cancelled) return
          try {
            const res = await authFetch(`/api/deals/${id}/labor`)
            if (!res.ok) return
            const data = (await res.json()) as { totalCost?: number }
            result[id] = Number(data.totalCost ?? 0)
          } catch {
            result[id] = 0
          }
        })
      )
      if (!cancelled) setMap(result)
    }
    void fetchAll()
    return () => {
      cancelled = true
    }
  }, [dealIds.join(',')])

  return map
}
