'use client'

import { useTranslations } from 'next-intl'
import { XShape } from '@/types/offer'

interface XShapeInputProps {
  value: XShape
  onChange: (shape: XShape) => void
}

function mToCm(m: number): number {
  return Math.round(m * 100)
}

function cmToM(cm: number): number {
  return Math.round(cm) / 100
}

export function XShapeInput({ value, onChange }: XShapeInputProps) {
  const t = useTranslations('deals')

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400'

  const directionLabel = (dir: 'north' | 'south' | 'east' | 'west') => {
    const map = {
      north: t('dirNorth'),
      south: t('dirSouth'),
      east: t('dirEast'),
      west: t('dirWest'),
    }
    return map[dir]
  }

  const updateArm = (index: number, updates: Partial<XShape['arms'][0]>) => {
    const newArms = [...value.arms]
    newArms[index] = { ...newArms[index], ...updates }
    onChange({ ...value, arms: newArms })
  }

  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">{t('xShape')} — {t('shapeDimensions')}</h4>

      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">{t('shapeCenter')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.center.width)}
              onChange={(e) => onChange({ ...value, center: { ...value.center, width: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.center.length)}
              onChange={(e) => onChange({ ...value, center: { ...value.center, length: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h5 className="text-sm font-semibold text-white/80">{t('shapeArms')}</h5>
        {value.arms.map((arm, index) => (
          <div key={index} className="bg-white/5 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/80">{directionLabel(arm.direction)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={mToCm(arm.width)}
                  onChange={(e) => updateArm(index, { width: cmToM(parseFloat(e.target.value) || 0) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={mToCm(arm.length)}
                  onChange={(e) => updateArm(index, { length: cmToM(parseFloat(e.target.value) || 0) })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
