'use client'

import { LShape } from '@/types/offer'

interface LShapeInputProps {
  value: LShape
  onChange: (shape: LShape) => void
}

export function LShapeInput({ value, onChange }: LShapeInputProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-md font-semibold text-white/90">Г-образная (L) - מידות</h4>
      
      {/* Leg 1 */}
      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">נога 1 (רגל ראשונה)</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={value.leg1.width}
              onChange={(e) => onChange({
                ...value,
                leg1: { ...value.leg1, width: parseFloat(e.target.value) || 0 }
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
              value={value.leg1.length}
              onChange={(e) => onChange({
                ...value,
                leg1: { ...value.leg1, length: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Leg 2 */}
      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">נога 2 (רגל שנייה)</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={value.leg2.width}
              onChange={(e) => onChange({
                ...value,
                leg2: { ...value.leg2, width: parseFloat(e.target.value) || 0 }
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
              value={value.leg2.length}
              onChange={(e) => onChange({
                ...value,
                leg2: { ...value.leg2, length: parseFloat(e.target.value) || 0 }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Overlap (optional) */}
      <div className="bg-white/5 rounded p-3">
        <h5 className="text-sm font-semibold text-white/80 mb-2">הצטלבות (אופציונלי)</h5>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/70 mb-1">רוחב (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={value.overlap?.width || ''}
              onChange={(e) => onChange({
                ...value,
                overlap: {
                  width: parseFloat(e.target.value) || 0,
                  length: value.overlap?.length || 0
                }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">אורך (מ׳)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={value.overlap?.length || ''}
              onChange={(e) => onChange({
                ...value,
                overlap: {
                  width: value.overlap?.width || 0,
                  length: parseFloat(e.target.value) || 0
                }
              })}
              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-400"
              placeholder="0"
            />
          </div>
        </div>
        <p className="text-xs text-white/50 mt-2">
          אם לא צוין, החישוב יתבצע אוטומטית
        </p>
      </div>
    </div>
  )
}



