'use client'

import type { Deal } from '../../deal-types'
import { useCRMTranslations } from '../../useCRMTranslations'

interface PergolaDealFormProps {
  value: Partial<Deal>
  onChange: (field: keyof Deal, value: Deal[keyof Deal]) => void
  stages: Array<{ id: string; label: string }>
}

export function PergolaDealForm({ value, onChange, stages }: PergolaDealFormProps) {
  const t = useCRMTranslations()
  const inputClass = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none'
  const labelClass = 'block text-sm font-medium text-white/70 mb-2'

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className={labelClass}>{t.deals.projectType}</label>
        <select
          value={value.project_type || ''}
          onChange={(e) => onChange('project_type', (e.target.value || null) as Deal['project_type'])}
          className={inputClass}
        >
          <option value="">-</option>
          <option value="pergola">{t.deals.projectTypes.pergola}</option>
          <option value="railing">{t.deals.projectTypes.railing}</option>
          <option value="gates">{t.deals.projectTypes.gates}</option>
          <option value="windows">{t.deals.projectTypes.windows}</option>
          <option value="laundry_closet">{t.deals.projectTypes.laundry_closet}</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>{t.deals.stage}</label>
        <select
          value={value.stage || ''}
          onChange={(e) => onChange('stage', (e.target.value || null) as Deal['stage'])}
          className={inputClass}
        >
          <option value="">-</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>{t.deals.width}</label>
        <input
          type="number"
          value={value.width ?? ''}
          onChange={(e) => onChange('width', e.target.value ? parseFloat(e.target.value) : null)}
          className={inputClass}
          placeholder="0"
        />
      </div>
      <div>
        <label className={labelClass}>{t.deals.depth}</label>
        <input
          type="number"
          value={value.depth ?? ''}
          onChange={(e) => onChange('depth', e.target.value ? parseFloat(e.target.value) : null)}
          className={inputClass}
          placeholder="0"
        />
      </div>
      <div>
        <label className={labelClass}>{t.deals.shape}</label>
        <select
          value={value.shape || ''}
          onChange={(e) => onChange('shape', (e.target.value || null) as Deal['shape'])}
          className={inputClass}
        >
          <option value="">-</option>
          <option value="прямоугольник">{t.deals.rectangle}</option>
          <option value="Г-образная">{t.deals.lShape}</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>{t.deals.lighting}</label>
        <input
          value={value.lighting || ''}
          onChange={(e) => onChange('lighting', e.target.value || null)}
          className={inputClass}
          placeholder={t.deals.lighting}
        />
      </div>
      <div>
        <label className={labelClass}>{t.deals.material}</label>
        <input
          value={value.material || ''}
          onChange={(e) => onChange('material', e.target.value || null)}
          className={inputClass}
          placeholder={t.deals.material}
        />
      </div>
      <div>
        <label className={labelClass}>{t.deals.colorRal}</label>
        <input
          value={value.color_ral || ''}
          onChange={(e) => onChange('color_ral', e.target.value || null)}
          className={inputClass}
          placeholder={t.deals.colorRal}
        />
      </div>
    </div>
  )
}
