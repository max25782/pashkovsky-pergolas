'use client'

import { XShape } from '@/types/offer'

interface XShapeInputProps {
  value: XShape
  onChange: (shape: XShape) => void
}

const directionLabels: Record<'north' | 'south' | 'east' | 'west', string> = {
  north: 'צפון',
  south: 'דרום',
  east: 'מזרח',
  west: 'מערב',
}

export function XShapeInput({ value, onChange }: XShapeInputProps) {
  const updateArm = (index: number, updates: Partial<XShape['arms'][0]>) => {
    const newArms = [...value.arms]
    newArms[index] = { ...newArms[index], ...updates }
    onChange({ ...value, arms: newArms })
  }

  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">Х-образная (X) - מידות</h4>
      
      {/* Center */}
      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">מרכז</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={value.center.width}
              onChange={(e) => onChange({
                ...value,
                center: { ...value.center, width: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">אורך (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={value.center.length}
              onChange={(e) => onChange({
                ...value,
                center: { ...value.center, length: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Arms */}
      <div className="space-y-3">
        <h5 className="text-sm font-semibold text-white/80">זרועות</h5>
        {value.arms.map((arm, index) => (
          <div key={index} className="bg-white/5 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/80">
                {directionLabels[arm.direction]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={arm.width}
                  onChange={(e) => updateArm(index, { width: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1">אורך (מ׳)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={arm.length}
                  onChange={(e) => updateArm(index, { length: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


