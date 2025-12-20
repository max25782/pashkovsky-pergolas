'use client'

import { UShape } from '@/types/offer'

interface UShapeInputProps {
  value: UShape
  onChange: (shape: UShape) => void
}

export function UShapeInput({ value, onChange }: UShapeInputProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">П-образная (U) - מידות</h4>
      
      {/* Base */}
      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">בסיס</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={value.base.width}
              onChange={(e) => onChange({
                ...value,
                base: { ...value.base, width: parseFloat(e.target.value) || 0 }
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
              value={value.base.length}
              onChange={(e) => onChange({
                ...value,
                base: { ...value.base, length: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Left Leg */}
      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">רגל שמאלית</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={value.leftLeg.width}
              onChange={(e) => onChange({
                ...value,
                leftLeg: { ...value.leftLeg, width: parseFloat(e.target.value) || 0 }
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
              value={value.leftLeg.length}
              onChange={(e) => onChange({
                ...value,
                leftLeg: { ...value.leftLeg, length: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Right Leg */}
      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">רגל ימנית</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={value.rightLeg.width}
              onChange={(e) => onChange({
                ...value,
                rightLeg: { ...value.rightLeg, width: parseFloat(e.target.value) || 0 }
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
              value={value.rightLeg.length}
              onChange={(e) => onChange({
                ...value,
                rightLeg: { ...value.rightLeg, length: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>
    </div>
  )
}


