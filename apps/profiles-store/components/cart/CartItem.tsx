'use client'

import Image from 'next/image'
import { CartItem as CartItemType } from '@/lib/cart-store'
import { type Locale } from '@/lib/locales'

interface CartItemProps {
  item: CartItemType
  locale: Locale
  onUpdateQuantity: (profileId: string, color: string, length: number, quantity: number) => void
  onRemove: (profileId: string, color: string, length: number) => void
}

export function CartItem({ item, locale, onUpdateQuantity, onRemove }: CartItemProps) {
  const totalLength = item.quantity * item.length
  const totalWeight = item.quantity * (item.weightPerPiece ?? 0)
  const isRtl = locale === 'he'

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
      {/* Image */}
      <td className="py-3 px-3">
        <div className="relative w-16 h-16 bg-gray-700 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.code} fill className="object-contain p-1" sizes="64px" />
          ) : (
            <span className="text-gray-500 text-xs">—</span>
          )}
        </div>
      </td>

      {/* Code + category */}
      <td className="py-3 px-3 text-right">
        <div className="font-semibold text-white text-sm">{item.code}</div>
        {item.color && item.color !== 'default' && (
          <div className="text-gray-400 text-xs mt-0.5">{item.color}</div>
        )}
      </td>

      {/* Qty stepper */}
      <td className="py-3 px-3">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onUpdateQuantity(item.profileId, item.color, item.length, item.quantity - 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors"
          >
            −
          </button>
          <span className="w-8 text-center text-white font-semibold text-sm">{item.quantity}</span>
          <button
            onClick={() => onUpdateQuantity(item.profileId, item.color, item.length, item.quantity + 1)}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white font-bold transition-colors"
          >
            +
          </button>
        </div>
      </td>

      {/* Length per unit */}
      <td className="py-3 px-3 text-center text-white text-sm">
        {item.length.toFixed(2)}<sub className="text-gray-400 text-xs">m</sub>
      </td>

      {/* Total length */}
      <td className="py-3 px-3 text-center text-white text-sm font-medium">
        {totalLength.toFixed(2)}<sub className="text-gray-400 text-xs">m</sub>
      </td>

      {/* Total weight */}
      <td className="py-3 px-3 text-center text-white text-sm font-medium">
        {totalWeight.toFixed(2)}<sub className="text-gray-400 text-xs">kg</sub>
      </td>

      {/* Remove */}
      <td className="py-3 px-2 text-center">
        <button
          onClick={() => onRemove(item.profileId, item.color, item.length)}
          className="w-7 h-7 rounded-full bg-gray-600 hover:bg-red-600 text-white flex items-center justify-center transition-colors mx-auto"
          title={isRtl ? 'הסר' : 'Remove'}
        >
          ×
        </button>
      </td>
    </tr>
  )
}
