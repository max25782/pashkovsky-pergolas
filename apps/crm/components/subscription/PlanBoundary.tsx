'use client'

import { Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSubscriptionPlan } from '@/components/subscription/subscription-plan-context'
import { minPlanForFeature } from '@/lib/subscription/plan-access'
import type { SaasFeature } from '@/lib/subscription/plan-types'

export function PlanBoundary({
  feature,
  children,
}: {
  feature: SaasFeature
  children: React.ReactNode
}) {
  const { plan, loading, can } = useSubscriptionPlan()
  const t = useTranslations('subscription')

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-white/70">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-blue-400" />
      </div>
    )
  }

  if (!can(feature)) {
    const need = minPlanForFeature(feature)
    const planLabel = t(`planNames.${need}`)
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="max-w-md text-center rounded-2xl border border-white/15 bg-white/5 p-8">
          <Lock className="w-12 h-12 mx-auto text-amber-400 mb-4" aria-hidden />
          <h1 className="text-xl font-semibold text-white mb-2">{t('upgradeTitle')}</h1>
          <p className="text-white/70 text-sm">{t('availableInPlan', { plan: planLabel })}</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
