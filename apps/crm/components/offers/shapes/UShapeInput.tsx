'use client'

import { useTranslations } from 'next-intl'
import { UShape } from '@/types/offer'

interface UShapeInputProps {
  value: UShape
  onChange: (shape: UShape) => void
}

function mToCm(m: number): number {
  return Math.round(m * 100)
}

function cmToM(cm: number): number {
  return Math.round(cm) / 100
}

export function UShapeInput({ value, onChange }: UShapeInputProps) {
  const t = useTranslations('deals')

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400'

  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">{t('uShape')} — {t('shapeDimensions')}</h4>

      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">{t('shapeBase')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.base.width)}
              onChange={(e) => onChange({ ...value, base: { ...value.base, width: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.base.length)}
              onChange={(e) => onChange({ ...value, base: { ...value.base, length: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">{t('shapeLeftLeg')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.leftLeg.width)}
              onChange={(e) => onChange({ ...value, leftLeg: { ...value.leftLeg, width: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.leftLeg.length)}
              onChange={(e) => onChange({ ...value, leftLeg: { ...value.leftLeg, length: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">{t('shapeRightLeg')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.rightLeg.width)}
              onChange={(e) => onChange({ ...value, rightLeg: { ...value.rightLeg, width: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.rightLeg.length)}
              onChange={(e) => onChange({ ...value, rightLeg: { ...value.rightLeg, length: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
