'use client'

import type { DealRailingsDetails, RailingsGlazingSystem } from './deal-types'

export interface RailingsFormValue {
  meters_total: number | null
  height_cm: number | null
  profile_type: string
  color: string
  location_type: 'balcony' | 'stairs' | 'roof' | 'yard' | 'other'
  glazing_system: RailingsGlazingSystem | ''
  glass_type: string
  notes: string
}

const LOCATION_OPTIONS: { value: DealRailingsDetails['location_type']; label: string }[] = [
  { value: 'balcony', label: 'Balcony / מרפסת' },
  { value: 'stairs', label: 'Stairs / מדרגות' },
  { value: 'roof', label: 'Roof / גג' },
  { value: 'yard', label: 'Yard / חצר' },
  { value: 'other', label: 'Other / אחר' },
]

interface RailingsFormFieldsProps {
  value: RailingsFormValue
  onChange: (value: RailingsFormValue) => void
  readOnly?: boolean
  translations?: {
    metersTotal: string
    heightCm: string
    profileType: string
    color: string
    locationType: string
    glazingSystem: string
    glazingAluminumGlass: string
    glazingWet: string
    glazingDry: string
    glassType: string
    notes: string
    required: string
    profilePlaceholder?: string
  }
}

const defaultTranslations = {
  metersTotal: 'Meters Total / מטרים סה"כ',
  heightCm: 'Height (cm) / גובה (ס"מ)',
  profileType: 'Profile Type / סוג פרופיל',
  color: 'Color / צבע',
  locationType: 'Location / מיקום',
  glazingSystem: 'Glazing / זיגוג',
  glazingAluminumGlass: 'Aluminum + glass / אלומיניום בשילוב זכוכית',
  glazingWet: 'Wet glazing / זיגוג רטוב',
  glazingDry: 'Dry glazing / זיגוג יבש',
  glassType: 'Glass detail (optional) / פירוט זכוכית',
  notes: 'Notes / הערות',
  required: '*',
}

const GLAZING_OPTIONS: { value: RailingsGlazingSystem; labelKey: keyof Pick<
  typeof defaultTranslations,
  'glazingAluminumGlass' | 'glazingWet' | 'glazingDry'
> }[] = [
  { value: 'aluminum_glass', labelKey: 'glazingAluminumGlass' },
  { value: 'wet_glazing', labelKey: 'glazingWet' },
  { value: 'dry_glazing', labelKey: 'glazingDry' },
]

export function RailingsFormFields({
  value,
  onChange,
  readOnly = false,
  translations = defaultTranslations,
}: RailingsFormFieldsProps) {
  const t = { ...defaultTranslations, ...translations }

  function update<K extends keyof RailingsFormValue>(field: K, val: RailingsFormValue[K]) {
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
          <span className={labelClass}>{t.profileType}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.profile_type || '-'}
          </div>
        </div>
        <div>
          <span className={labelClass}>{t.color}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.color || '-'}
          </div>
        </div>
        <div>
          <span className={labelClass}>{t.locationType}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {LOCATION_OPTIONS.find((o) => o.value === value.location_type)?.label ?? value.location_type ?? '-'}
          </div>
        </div>
        <div>
          <span className={labelClass}>{t.glazingSystem}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.glazing_system
              ? t[GLAZING_OPTIONS.find((o) => o.value === value.glazing_system)?.labelKey ?? 'glazingSystem']
              : '-'}
          </div>
        </div>
        <div>
          <span className={labelClass}>{t.glassType}</span>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white">
            {value.glass_type || '-'}
          </div>
        </div>
        {value.notes && (
          <div className="md:col-span-2">
            <span className={labelClass}>{t.notes}</span>
            <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white whitespace-pre-wrap">
              {value.notes}
            </div>
          </div>
        )}
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
          {t.profileType} <span className="text-red-400">{t.required}</span>
        </label>
        <input
          value={value.profile_type}
          onChange={(e) => update('profile_type', e.target.value)}
          className={inputClass}
          placeholder={t.profilePlaceholder ?? 'Profile type'}
        />
      </div>
      <div>
        <label className={labelClass}>
          {t.color} <span className="text-red-400">{t.required}</span>
        </label>
        <input
          value={value.color}
          onChange={(e) => update('color', e.target.value)}
          className={inputClass}
          placeholder="RAL / white/black/cream/wood"
        />
      </div>
      <div>
        <label className={labelClass}>
          {t.locationType} <span className="text-red-400">{t.required}</span>
        </label>
        <select
          value={value.location_type}
          onChange={(e) => update('location_type', e.target.value as RailingsFormValue['location_type'])}
          className={inputClass}
        >
          {LOCATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>
          {t.glazingSystem} <span className="text-red-400">{t.required}</span>
        </label>
        <select
          value={value.glazing_system}
          onChange={(e) => update('glazing_system', e.target.value as RailingsFormValue['glazing_system'])}
          className={inputClass}
        >
          <option value="">-</option>
          {GLAZING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t[opt.labelKey]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t.glassType}</label>
        <input
          value={value.glass_type}
          onChange={(e) => update('glass_type', e.target.value)}
          className={inputClass}
          placeholder="e.g. 10mm / חלבי"
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
