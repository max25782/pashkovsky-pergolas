'use client'

import type { ContractorPaymentProfile } from '../../deal-types'
import { useCRMTranslations } from '../../useCRMTranslations'

const PRESET_10_20_30_30_10 = [
  { percent: 10, label: '10%' },
  { percent: 20, label: '20%' },
  { percent: 30, label: '30%' },
  { percent: 30, label: '30%' },
  { percent: 10, label: '10%' },
]

interface ContractorPaymentPlanProps {
  profile: ContractorPaymentProfile | null | undefined
  totalPrice: number | null | undefined
  formatCurrency: (amount: number) => string
}

export function ContractorPaymentPlan({
  profile,
  totalPrice,
  formatCurrency,
}: ContractorPaymentPlanProps) {
  const t = useCRMTranslations()
  const stages = profile?.preset === '10_20_30_30_10'
    ? PRESET_10_20_30_30_10
    : profile?.stages ?? PRESET_10_20_30_30_10
  const price = totalPrice ?? 0

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <h4 className="text-sm font-semibold text-white mb-3">{t.deals.paymentPlan}</h4>
      <div className="text-xs text-white/60 mb-3">{t.deals.paymentPlanPreset}</div>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const expected = (s.percent / 100) * price
          return (
            <div
              key={i}
              className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0"
            >
              <span className="text-white/80">{s.label ?? `${s.percent}%`}</span>
              <span className="text-green-400">{formatCurrency(expected)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
