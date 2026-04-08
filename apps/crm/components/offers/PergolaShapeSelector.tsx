'use client'

import { useTranslations } from 'next-intl'
import { PergolaShape, PergolaShapeType } from '@/types/offer'
import { RectangleShapeInput } from './shapes/RectangleShapeInput'
import { LShapeInput } from './shapes/LShapeInput'
import { XShapeInput } from './shapes/XShapeInput'
import { UShapeInput } from './shapes/UShapeInput'

interface PergolaShapeSelectorProps {
  value: PergolaShape
  onChange: (shape: PergolaShape) => void
}

export function PergolaShapeSelector({ value, onChange }: PergolaShapeSelectorProps) {
  const t = useTranslations('deals')

  const handleShapeTypeChange = (newType: PergolaShapeType) => {
    switch (newType) {
      case 'rectangle':
        onChange({ type: 'rectangle', width: 4, length: 6 })
        break
      case 'L':
        onChange({
          type: 'L',
          leg1: { width: 4, length: 6 },
          leg2: { width: 3, length: 4 },
        })
        break
      case 'X':
        onChange({
          type: 'X',
          center: { width: 2, length: 2 },
          arms: [
            { direction: 'north', width: 3, length: 4 },
            { direction: 'south', width: 3, length: 4 },
            { direction: 'east', width: 4, length: 3 },
            { direction: 'west', width: 4, length: 3 },
          ],
        })
        break
      case 'U':
        onChange({
          type: 'U',
          base: { width: 6, length: 4 },
          leftLeg: { width: 3, length: 3 },
          rightLeg: { width: 3, length: 3 },
        })
        break
    }
  }

  const btnCls = (active: boolean) =>
    `px-4 py-2 rounded border transition ${
      active
        ? 'bg-blue-600 border-blue-500 text-white'
        : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
    }`

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-white/80 mb-2">{t('shapeTypeLabel')}</label>
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={() => handleShapeTypeChange('rectangle')} className={btnCls(value.type === 'rectangle')}>
            {t('rectangle')}
          </button>
          <button type="button" onClick={() => handleShapeTypeChange('L')} className={btnCls(value.type === 'L')}>
            {t('lShape')}
          </button>
          <button type="button" onClick={() => handleShapeTypeChange('X')} className={btnCls(value.type === 'X')}>
            {t('xShape')}
          </button>
          <button type="button" onClick={() => handleShapeTypeChange('U')} className={btnCls(value.type === 'U')}>
            {t('uShape')}
          </button>
        </div>
      </div>

      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        {value.type === 'rectangle' && <RectangleShapeInput value={value} onChange={onChange} />}
        {value.type === 'L' && <LShapeInput value={value} onChange={onChange} />}
        {value.type === 'X' && <XShapeInput value={value} onChange={onChange} />}
        {value.type === 'U' && <UShapeInput value={value} onChange={onChange} />}
      </div>
    </div>
  )
}
