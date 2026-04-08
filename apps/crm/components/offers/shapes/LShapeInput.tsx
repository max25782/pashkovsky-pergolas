'use client'

import { useTranslations } from 'next-intl'
import { LShape } from '@/types/offer'

interface LShapeInputProps {
  value: LShape
  onChange: (shape: LShape) => void
}

function mToCm(m: number): number {
  return Math.round(m * 100)
}

function cmToM(cm: number): number {
  return Math.round(cm) / 100
}

export function LShapeInput({ value, onChange }: LShapeInputProps) {
  const t = useTranslations('deals')

  const inputCls = 'w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400'

  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">{t('lShape')} — {t('shapeDimensions')}</h4>

      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">{t('shapeLeg1')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.leg1.width)}
              onChange={(e) => onChange({ ...value, leg1: { ...value.leg1, width: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.leg1.length)}
              onChange={(e) => onChange({ ...value, leg1: { ...value.leg1, length: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">{t('shapeLeg2')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.leg2.width)}
              onChange={(e) => onChange({ ...value, leg2: { ...value.leg2, width: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
            <input
              type="number"
              step="1"
              min="1"
              value={mToCm(value.leg2.length)}
              onChange={(e) => onChange({ ...value, leg2: { ...value.leg2, length: cmToM(parseFloat(e.target.value) || 0) } })}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">{t('shapeOverlap')}</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeWidth')}</label>
            <input
              type="number"
              step="1"
              min="0"
              value={value.overlap ? mToCm(value.overlap.width) : ''}
              onChange={(e) => onChange({
                ...value,
                overlap: { width: cmToM(parseFloat(e.target.value) || 0), length: value.overlap ? value.overlap.length : 0 },
              })}
              className={inputCls}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">{t('shapeLength')}</label>
            <input
              type="number"
              step="1"
              min="0"
              value={value.overlap ? mToCm(value.overlap.length) : ''}
              onChange={(e) => onChange({
                ...value,
                overlap: { width: value.overlap ? value.overlap.width : 0, length: cmToM(parseFloat(e.target.value) || 0) },
              })}
              className={inputCls}
              placeholder="0"
            />
          </div>
        </div>
        <p className="text-xs text-white/50 mt-2">{t('shapeOverlapAuto')}</p>
      </div>
    </div>
  )
}
