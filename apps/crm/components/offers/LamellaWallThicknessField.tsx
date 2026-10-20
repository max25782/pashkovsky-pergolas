'use client'

import { useTranslations } from 'next-intl'
import {
  LAMELLA_70_08_ID,
  LAMELLA_70_16_ID,
  LAMELLA_70_10_ID,
  resolveLamellaPatternIds,
  type PlanConstructionParams,
} from '@pashkovsky/pergola-core'

interface LamellaWallThicknessFieldProps {
  params: PlanConstructionParams
  onChange: (params: PlanConstructionParams) => void
  selectClass: string
  labelClass: string
}

export function LamellaWallThicknessField({
  params,
  onChange,
  selectClass,
  labelClass,
}: LamellaWallThicknessFieldProps) {
  const t = useTranslations('planEditor')
  const uses70 = resolveLamellaPatternIds(params.lamellaPatternId, params.lamellaWallThicknessMm)
    .some((id) => id === LAMELLA_70_08_ID || id === LAMELLA_70_16_ID || id === LAMELLA_70_10_ID)
  if (!uses70) return null

  const value = params.lamellaWallThicknessMm === 1.6 ? '1.6' : '0.8'

  return (
    <label className={labelClass}>
      {t('paramsPanel.lamellaWallThicknessLabel')}
      <select
        className={selectClass}
        value={value}
        onChange={(e) => {
          onChange({
            ...params,
            lamellaWallThicknessMm: e.target.value === '1.6' ? 1.6 : 0.8,
          })
        }}
      >
        <option value="0.8">{t('paramsPanel.lamellaWallThickness08')}</option>
        <option value="1.6">{t('paramsPanel.lamellaWallThickness16')}</option>
      </select>
    </label>
  )
}
