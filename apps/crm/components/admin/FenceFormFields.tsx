'use client'

import type { FenceVariant } from './deal-types'

export interface FenceFormValue {
  meters_total: number | null
  height_cm: number | null
  fence_variant: FenceVariant | ''
  color: string
  notes: string
}

const VARIANT_OPTIONS: { value: FenceVariant; labelKey: 'fenceClassic' | 'fenceHitech' | 'fenceHitechAngular' }[] = [
  { value: 'classic', labelKey: 'fenceClassic' },
  { value: 'hitech', labelKey: 'fenceHitech' },
  { value: 'hitech_angular', labelKey: 'fenceHitechAngular' },
]

interface FenceFormFieldsProps {
  value: FenceFormValue
  onChange: (value: FenceFormValue) => void
  readOnly?: boolean
  translations?: {
    metersTotal: string
    heightCm: string
    fenceVariant: string
    fenceClassic: string
    fenceHitech: string
    fenceHitechAngular: string
    color: string
    notes: string
    required: string
  }
}

const defaultTranslations = {
  metersTotal: 'Meters total',
  heightCm: 'Height (cm)',
  fenceVariant: 'Fence type',
  fenceClassic: 'Classic',
  fenceHitech: 'Hi-tech',
  fenceHitechAngular: 'Hi-tech angular',
  color: 'Color',
  notes: 'Notes',
  required: '*',
}

export function FenceFormFields({
  value,
  onChange,
  readOnly = false,
  translations = defaultTranslations,
}: FenceFormFieldsProps) {
  const t = { ...defaultTranslations, ...translations }

  function update<K extends keyof FenceFormValue>(field: K, val: FenceFormValue[K]) {
    onChange({ ...value, [field]: val })
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none'
  const labelClass = 'block text-sm font-medium text-white/70 mb-2'

  if (readOnly) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className={labelClass}>{t.metersTotal}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.meters_total ?? '-'}
          </div>
        </div>
        <div>
          <span className={labelClass}>{t.heightCm}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.height_cm ?? '-'}
          </div>
        </div>
        <div>
          <span className={labelClass}>{t.fenceVariant}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.fence_variant
              ? t[VARIANT_OPTIONS.find((o) => o.value === value.fence_variant)?.labelKey ?? 'fenceVariant']
              : '-'}
          </div>
        </div>
        <div>
          <span className={labelClass}>{t.color}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.color || '-'}
          </div>
        </div>
        {value.notes ? (
          <div className="md:col-span-2">
            <span className={labelClass}>{t.notes}</span>
            <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white whitespace-pre-wrap">
              {value.notes}
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>
          {t.metersTotal} <span className="text-red-400">{t.required}</span>
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value.meters_total ?? ''}
          onChange={(e) => update('meters_total', e.target.value ? parseFloat(e.target.value) : null)}
          className={inputClass}
          placeholder="0"
        />
      </div>
      <div>
        <label className={labelClass}>{t.heightCm}</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value.height_cm ?? ''}
          onChange={(e) => update('height_cm', e.target.value ? parseFloat(e.target.value) : null)}
          className={inputClass}
          placeholder="0"
        />
      </div>
      <div>
        <label className={labelClass}>
          {t.fenceVariant} <span className="text-red-400">{t.required}</span>
        </label>
        <select
          value={value.fence_variant}
          onChange={(e) => update('fence_variant', e.target.value as FenceFormValue['fence_variant'])}
          className={inputClass}
        >
          <option value="">-</option>
          {VARIANT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t[opt.labelKey]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>
          {t.color} <span className="text-red-400">{t.required}</span>
        </label>
        <input
          value={value.color}
          onChange={(e) => update('color', e.target.value)}
          className={inputClass}
          placeholder="RAL / לבן / שחור..."
        />
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>{t.notes}</label>
        <textarea
          value={value.notes}
          onChange={(e) => update('notes', e.target.value)}
          className={`${inputClass} min-h-[80px]`}
          placeholder={t.notes}
        />
      </div>
    </div>
  )
}
