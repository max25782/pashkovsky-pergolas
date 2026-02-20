'use client'

import { RailingsFormFields, type RailingsFormValue } from '../../RailingsFormFields'
import { useCRMTranslations } from '../../useCRMTranslations'

interface RailingsDealFormProps {
  value: RailingsFormValue
  onChange: (value: RailingsFormValue) => void
  readOnly?: boolean
}

export function RailingsDealForm({ value, onChange, readOnly = false }: RailingsDealFormProps) {
  const t = useCRMTranslations()
  return (
    <RailingsFormFields
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      translations={{
        metersTotal: t.deals.metersTotal,
        heightCm: t.deals.heightCm,
        profileType: t.deals.profileType,
        color: t.deals.color,
        locationType: t.deals.locationType,
        glassType: t.deals.glassType,
        notes: t.deals.notes,
        required: t.deals.required,
      }}
    />
  )
}
