'use client'

import type { Deal } from '../../deal-types'
import type { WorkType } from '../../deal-types'
import { getStages } from '../../deal-types'
import { useCRMTranslations } from '../../useCRMTranslations'
import { PergolaDealForm } from './PergolaDealForm'
import { RailingsDealForm } from './RailingsDealForm'
import type { RailingsFormValue } from '../../RailingsFormFields'

interface DealTemplateRendererProps {
  workType: WorkType
  mode: 'create' | 'edit'
  dealValue: Partial<Deal>
  onDealChange: (field: keyof Deal, value: Deal[keyof Deal]) => void
  railingsValue?: RailingsFormValue
  onRailingsChange?: (value: RailingsFormValue) => void
}

export function DealTemplateRenderer({
  workType,
  mode,
  dealValue,
  onDealChange,
  railingsValue,
  onRailingsChange,
}: DealTemplateRendererProps) {
  const t = useCRMTranslations()
  const stages = getStages(t.deals)

  if (workType === 'railings') {
    if (!railingsValue || !onRailingsChange) return null
    return (
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">{t.deals.railingsDetails}</h3>
        <RailingsDealForm
          value={railingsValue}
          onChange={onRailingsChange}
          readOnly={false}
        />
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">{t.deals.projectInfo}</h3>
      <PergolaDealForm value={dealValue} onChange={onDealChange} stages={stages} />
    </div>
  )
}
