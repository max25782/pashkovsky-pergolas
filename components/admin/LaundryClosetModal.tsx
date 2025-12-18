'use client'

import { useState, useEffect } from 'react'
import type { Deal } from './deal-types'

interface LaundryClosetModalProps {
  deal: Deal
  onClose: () => void
  onSave: (data: {
    laundry_model: string | null
    laundry_distance: number | null
    laundry_lighting: boolean | null
    shape: 'ר' | 'ח' | 'מקיר לקיר' | null
    width?: number | null
    depth?: number | null
  }) => void
}

export function LaundryClosetModal({
  deal,
  onClose,
  onSave,
}: LaundryClosetModalProps) {
  const [model, setModel] = useState(deal.laundry_model || '')
  const [distance, setDistance] = useState(deal.laundry_distance?.toString() || '')
  const [width, setWidth] = useState(deal.width?.toString() || '')
  const [depth, setDepth] = useState(deal.depth?.toString() || '')
  const [lighting, setLighting] = useState(deal.laundry_lighting ?? false)
  const [shape, setShape] = useState<'ר' | 'ח' | 'מקיר לקיר' | null>(
    (deal.shape as 'ר' | 'ח' | 'מקיר לקיר') || null
  )

  function handleSave() {
    onSave({
      laundry_model: model.trim() || null,
      laundry_distance: distance ? parseFloat(distance) : null,
      laundry_lighting: lighting,
      shape: shape,
      width: width ? parseFloat(width) : null,
      depth: depth ? parseFloat(depth) : null,
    })
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-white/20 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">מסתור כביסה - פרטי פרויקט</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* דגם מסתור */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              דגם מסתור
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none text-white"
              placeholder="הכנס דגם מסתור"
            />
          </div>

          {/* רוחב ועומק */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                רוחב (מ"מ)
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none text-white"
                placeholder="0"
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                עומק (מ"מ)
              </label>
              <input
                type="number"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none text-white"
                placeholder="0"
                min="0"
                step="0.1"
              />
            </div>
          </div>

          {/* מרחק */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              מרחק (ס"מ)
            </label>
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none text-white"
              placeholder="0"
              min="0"
              step="0.1"
            />
          </div>

          {/* אור */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lighting}
                onChange={(e) => setLighting(e.target.checked)}
                className="w-5 h-5 rounded bg-white/5 border border-white/20 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-white/70">אור</span>
            </label>
          </div>

          {/* צורה */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              צורה
            </label>
            <select
              value={shape || ''}
              onChange={(e) => setShape((e.target.value || null) as 'ר' | 'ח' | 'מקיר לקיר' | null)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/20 focus:bg-white/10 focus:outline-none text-white"
            >
              <option value="">-</option>
              <option value="ר">ר</option>
              <option value="ח">ח</option>
              <option value="מקיר לקיר">מקיר לקיר</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold text-white"
            >
              שמור
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 font-semibold text-white"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

