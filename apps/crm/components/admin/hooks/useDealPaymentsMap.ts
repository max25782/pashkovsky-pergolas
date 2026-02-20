'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'

export function useDealPaymentsMap(dealIds: string[]): Record<string, number> {
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
            const res = await authFetch(`/admin-api/deals/${id}/payments`)
            if (!res.ok) return
            const data = await res.json()
            const total = (data.payments ?? []).reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0)
            result[id] = total
          } catch {
            result[id] = 0
          }
        })
      )
      if (!cancelled) setMap(result)
    }
    fetchAll()
    return () => { cancelled = true }
  }, [dealIds.join(',')])

  return map
}
