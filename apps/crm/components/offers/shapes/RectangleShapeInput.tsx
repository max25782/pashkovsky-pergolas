'use client'

import { RectangleShape } from '@/types/offer'

interface RectangleShapeInputProps {
  value: RectangleShape
  onChange: (shape: RectangleShape) => void
}

export function RectangleShapeInput({ value, onChange }: RectangleShapeInputProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">מלבנית - מידות</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/80 mb-1">רוחב (מ׳)</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={value.width}
            onChange={(e) => onChange({ ...value, width: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm text-white/80 mb-1">אורך (מ׳)</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={value.length}
            onChange={(e) => onChange({ ...value, length: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>
      <div className="text-sm text-white/60">
        שטח: {(value.width * value.length).toFixed(2)} מ״ר
      </div>
    </div>
  )
}



