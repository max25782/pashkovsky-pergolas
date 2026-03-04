'use client'

import { CartItem } from '@/lib/cart-store'
import { type Locale } from '@/lib/locales'

interface CartSummaryProps {
  items: CartItem[]
  locale: Locale
}

export function CartSummary({ items, locale }: CartSummaryProps) {
  const totalWeight = items.reduce((sum, i) => sum + (i.weightPerPiece ?? 0) * i.quantity, 0)
  const totalLength = items.reduce((sum, i) => sum + i.length * i.quantity, 0)
  const totalItems  = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <tr className="bg-gray-800 text-white font-bold text-sm border-t border-gray-600">
      {/* image col — empty */}
      <td className="py-4 px-3" />

      {/* סה"כ יחידות */}
      <td className="py-4 px-3 text-right">
        <div className="text-xs text-gray-400 uppercase tracking-wide">
          {locale === 'he' ? 'סה"כ יחידות' : 'Total units'}
        </div>
        <div className="text-lg font-extrabold text-white">
          {totalItems}<sub className="text-xs font-semibold text-gray-400">pc</sub>
        </div>
      </td>

      {/* qty col — empty */}
      <td className="py-4 px-3" />

      {/* אורך ליחידה col — empty */}
      <td className="py-4 px-3" />

      {/* סה"כ אורך */}
      <td className="py-4 px-3 text-center">
        <div className="text-xs text-gray-400 uppercase tracking-wide">
          {locale === 'he' ? 'סה"כ אורך' : 'Total length'}
        </div>
        <div className="text-lg font-extrabold text-white">
          {totalLength.toFixed(2)}<sub className="text-xs font-semibold text-gray-400">m</sub>
        </div>
      </td>

      {/* סה"כ משקל */}
      <td className="py-4 px-3 text-center">
        <div className="text-xs text-gray-400 uppercase tracking-wide">
          {locale === 'he' ? 'סה"כ משקל' : 'Total weight'}
        </div>
        <div className="text-lg font-extrabold text-white">
          {totalWeight.toFixed(2)}<sub className="text-xs font-semibold text-gray-400">kg</sub>
        </div>
      </td>

      {/* remove col — empty */}
      <td className="py-4 px-2" />
    </tr>
  )
}
