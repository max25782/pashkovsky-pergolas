'use client'

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
  const handleShapeTypeChange = (newType: PergolaShapeType) => {
    // Reset to default shape when type changes
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

  return (
    <div className="space-y-4">
      {/* Shape Type Selector */}
      <div>
        <label className="block text-sm text-white/80 mb-2">סוג צורה</label>
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleShapeTypeChange('rectangle')}
            className={`px-4 py-2 rounded border transition ${
              value.type === 'rectangle'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
            }`}
          >
            מלבנית
          </button>
          <button
            type="button"
            onClick={() => handleShapeTypeChange('L')}
            className={`px-4 py-2 rounded border transition ${
              value.type === 'L'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
            }`}
          >
            Г-образная
          </button>
          <button
            type="button"
            onClick={() => handleShapeTypeChange('X')}
            className={`px-4 py-2 rounded border transition ${
              value.type === 'X'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
            }`}
          >
            Х-образная
          </button>
          <button
            type="button"
            onClick={() => handleShapeTypeChange('U')}
            className={`px-4 py-2 rounded border transition ${
              value.type === 'U'
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'
            }`}
          >
            П-образная
          </button>
        </div>
      </div>

      {/* Shape-specific Input */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        {value.type === 'rectangle' && (
          <RectangleShapeInput
            value={value}
            onChange={onChange}
          />
        )}
        {value.type === 'L' && (
          <LShapeInput
            value={value}
            onChange={onChange}
          />
        )}
        {value.type === 'X' && (
          <XShapeInput
            value={value}
            onChange={onChange}
          />
        )}
        {value.type === 'U' && (
          <UShapeInput
            value={value}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  )
}



