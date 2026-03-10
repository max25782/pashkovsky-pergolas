'use client'

import { useState } from 'react'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import type { OrderItem } from './order-types'

interface Props {
  item: OrderItem
  orderId: string
  lang: string
  onUpdate: (orderId: string, itemId: string, pricePerPiece: number, color: string) => Promise<void>
}

export function OrderItemPriceRow({ item, orderId, onUpdate }: Props) {
  const t = useCRMTranslations()

  const initialPricePerKg =
    item.weight_per_piece > 0 ? item.price_per_piece / item.weight_per_piece : 0

  const [pricePerKg, setPricePerKg] = useState(initialPricePerKg)
  const [color, setColor] = useState(item.color === 'default' ? '' : (item.color || ''))

  async function handleBlur() {
    const resolvedColor = color.trim() || 'default'
    const newPricePerPiece = pricePerKg * (item.weight_per_piece || 0)
    await onUpdate(orderId, item.id, newPricePerPiece, resolvedColor)
  }

  return (
    <div className="bg-white/5 rounded p-3 space-y-2">
      <div className="text-sm">
        <span className="font-medium">
          {item.aluminum_profiles?.name_he || item.aluminum_profiles?.code || item.profile_id.slice(0, 8)}
        </span>
        <span className="text-white/50 font-mono ml-1 text-xs">
          {item.aluminum_profiles?.code}
        </span>
        <div className="text-white/50 text-xs mt-0.5">
          {item.length_meters}m × {item.quantity_pieces}
          {' · '}{item.total_weight_kg?.toFixed(2)} kg
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-white/60 text-xs whitespace-nowrap">{t.orders.colorLabel}</span>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            onBlur={handleBlur}
            placeholder={t.orders.colorPlaceholder}
            className="flex-1 px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-sm placeholder:text-white/30"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            step="0.01"
            min="0"
            value={pricePerKg}
            onChange={(e) => setPricePerKg(parseFloat(e.target.value) || 0)}
            onBlur={handleBlur}
            className="w-24 px-2 py-1 bg-black/30 border border-white/20 rounded text-white text-sm"
          />
          <span className="text-white/60 text-sm">₪/kg</span>
        </div>
      </div>
    </div>
  )
}
