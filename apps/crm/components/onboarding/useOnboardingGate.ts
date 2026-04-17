'use client'

import { useCallback, useEffect, useState } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { writeOnboardingDone } from '@/lib/onboarding/constants'

type OnboardingClientState = 'init' | 'incomplete' | 'complete'

export interface UseOnboardingGateParams {
  /** Supabase auth user id */
  userId: string | null
  /** Active company from `/api/companies/me` */
  companyId: string | null
  /**
   * Server-backed intro completion from `crm_intro_completed_at` on `company_members`.
   * null = `/api/companies/me` not loaded yet (do not show modal yet).
   */
  introRemoteComplete: boolean | null
}

export interface UseOnboardingGateResult {
  hydrated: boolean
  showOnboarding: boolean
  showFirstActions: boolean
  markOnboardingComplete: () => Promise<void>
}

export function useOnboardingGate({
  userId,
  companyId,
  introRemoteComplete,
}: UseOnboardingGateParams): UseOnboardingGateResult {
  const [state, setState] = useState<OnboardingClientState>('init')

  useEffect(() => {
    if (!userId || !companyId || introRemoteComplete === null) {
      setState('init')
      return
    }
    if (introRemoteComplete) {
      writeOnboardingDone(userId, companyId)
    }
    setState(introRemoteComplete ? 'complete' : 'incomplete')
  }, [userId, companyId, introRemoteComplete])

  const markOnboardingComplete = useCallback(async () => {
    if (!userId || !companyId) return
    try {
      const res = await authFetch('/api/companies/me/complete-crm-intro', { method: 'POST' })
      if (!res.ok) return
      writeOnboardingDone(userId, companyId)
      setState('complete')
    } catch {
      /* ignore */
    }
  }, [userId, companyId])

  const hydrated = state !== 'init'

  return {
    hydrated,
    showOnboarding: state === 'incomplete',
    showFirstActions: state === 'complete',
    markOnboardingComplete,
  }
}
