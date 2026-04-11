'use client'

import { SubscriptionPlanProvider } from '@/components/subscription/subscription-plan-context'

export function CRMSubscriptionProvider({ children }: { children: React.ReactNode }) {
  return <SubscriptionPlanProvider>{children}</SubscriptionPlanProvider>
}
