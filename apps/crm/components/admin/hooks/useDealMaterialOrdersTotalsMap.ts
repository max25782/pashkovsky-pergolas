'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'

export interface DealMaterialOrdersSummary {
  totalPrice: number
  orderCount: number
}

export function useDealMaterialOrdersTotalsMap(
  dealIds: string[],
): Record<string, DealMaterialOrdersSummary> {
  const [map, setMap] = useState<Record<string, DealMaterialOrdersSummary>>({})

  useEffect(() => {
    if (dealIds.length === 0) {
      setMap({})
      return
    }

    let cancelled = false
    const fetchAll = async () => {
      const result: Record<string, DealMaterialOrdersSummary> = {}
      const batch = dealIds.slice(0, 50)
      await Promise.all(
        batch.map(async (id) => {
          if (cancelled) return
          try {
            const res = await authFetch(`/api/material-orders?dealId=${encodeURIComponent(id)}`)
            if (!res.ok) return
            const data = (await res.json()) as {
              orders?: Array<{ total_price?: number | null; status?: string | null }>
            }
            const orders = data.orders ?? []
            let totalPrice = 0
            let orderCount = 0
            for (const o of orders) {
              if (o.status === 'cancelled') continue
              orderCount += 1
              const row = o.total_price != null ? Number(o.total_price) : 0
              if (Number.isFinite(row)) totalPrice += row
            }
            result[id] = { totalPrice, orderCount }
          } catch {
            result[id] = { totalPrice: 0, orderCount: 0 }
          }
        }),
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
