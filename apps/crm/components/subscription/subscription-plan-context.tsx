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
  memberRole: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  can: (feature: SaasFeature) => boolean
}

const SubscriptionPlanContext = createContext<SubscriptionPlanContextValue | null>(null)

export function SubscriptionPlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<SubscriptionPlan>('offer')
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [subRes, meRes] = await Promise.all([
        authFetch('/api/me/subscription'),
        authFetch('/api/companies/me'),
      ])

      if (!subRes.ok) {
        if (subRes.status === 401) {
          setPlan('offer')
          setMemberRole(null)
          setError(null)
          return
        }
        throw new Error(`HTTP ${subRes.status}`)
      }

      const subData = (await subRes.json()) as { plan?: string; role?: string }
      setPlan(normalizePlan(subData.plan))

      if (meRes.ok) {
        const meData = (await meRes.json()) as { role?: string }
        setMemberRole(meData.role ?? subData.role ?? null)
      } else {
        setMemberRole(subData.role ?? null)
      }
    } catch (e) {
      console.error('[SubscriptionPlanProvider]', e)
      setError('failed_to_load_plan')
      setPlan('offer')
      setMemberRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const can = useCallback(
    (feature: SaasFeature) => hasAccess({ plan }, feature, memberRole),
    [plan, memberRole],
  )

  const value = useMemo(
    () => ({ plan, memberRole, loading, error, refresh, can }),
    [plan, memberRole, loading, error, refresh, can],
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
