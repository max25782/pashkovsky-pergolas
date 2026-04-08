'use client'

import { useTranslations } from 'next-intl'
import { RectangleShape } from '@/types/offer'

interface RectangleShapeInputProps {
  value: RectangleShape
  onChange: (shape: RectangleShape) => void
}

/** Converts meters (internal) to centimeters for display */
function mToCm(m: number): number {
  return Math.round(m * 100)
}

/** Converts centimeters (user input) to meters (internal) */
function cmToM(cm: number): number {
  return Math.round(cm) / 100
}

export function RectangleShapeInput({ value, onChange }: RectangleShapeInputProps) {
  const t = useTranslations('deals')

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400'

  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">{t('rectangle')} — {t('shapeDimensions')}</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/80 mb-1">{t('shapeWidth')}</label>
          <input
            type="number"
            step="1"
            min="1"
            value={mToCm(value.width)}
            onChange={(e) => onChange({ ...value, width: cmToM(parseFloat(e.target.value) || 0) })}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm text-white/80 mb-1">{t('shapeLength')}</label>
          <input
            type="number"
            step="1"
            min="1"
            value={mToCm(value.length)}
            onChange={(e) => onChange({ ...value, length: cmToM(parseFloat(e.target.value) || 0) })}
            className={inputCls}
          />
        </div>
      </div>
      <div className="text-sm text-white/60">
        {t('shapeArea', { area: (value.width * value.length).toFixed(2) })}
      </div>
    </div>
  )
}
