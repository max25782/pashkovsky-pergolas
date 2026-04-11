'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { hasAccess, normalizePlan } from '@/lib/subscription/plan-access'
import type { SaasFeature } from '@/lib/subscription/plan-types'
import type { SubscriptionPlan } from '@/lib/subscription/plan-types'

interface SubscriptionPlanContextValue {
  plan: SubscriptionPlan
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  can: (feature: SaasFeature) => boolean
}

const SubscriptionPlanContext = createContext<SubscriptionPlanContextValue | null>(null)

export function SubscriptionPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<SubscriptionPlan>('offer')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/me/subscription')
      if (!res.ok) {
        if (res.status === 401) {
          setPlan('offer')
          setError(null)
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as { plan?: string }
      setPlan(normalizePlan(data.plan))
    } catch (e) {
      console.error('[SubscriptionPlanProvider]', e)
      setError('failed_to_load_plan')
      setPlan('offer')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const can = useCallback(
    (feature: SaasFeature) => hasAccess({ plan }, feature),
    [plan],
  )

  const value = useMemo(
    () => ({ plan, loading, error, refresh, can }),
    [plan, loading, error, refresh, can],
  )

  return (
    <SubscriptionPlanContext.Provider value={value}>{children}</SubscriptionPlanContext.Provider>
  )
}

export function useSubscriptionPlan(): SubscriptionPlanContextValue {
  const ctx = useContext(SubscriptionPlanContext)
  if (!ctx) {
    throw new Error('useSubscriptionPlan must be used within SubscriptionPlanProvider')
  }
  return ctx
}

/** Safe variant when provider is missing (e.g. tests). */
export function useSubscriptionPlanOptional(): SubscriptionPlanContextValue | null {
  return useContext(SubscriptionPlanContext)
}
