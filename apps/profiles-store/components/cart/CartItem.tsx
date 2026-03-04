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
  const isRtl = locale === 'he'
  const lineTotal = item.quantity * item.pricePerPiece

  return (
    <div
      className="bg-white rounded-lg border border-gray-100 shadow-card overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="flex gap-3 p-3">
        {/* Image */}
        {item.imageUrl && (
          <div className="relative w-20 h-20 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
            <Image
              src={item.imageUrl}
              alt={item.code}
              fill
              className="object-contain p-1"
              sizes="80px"
            />
          </div>
        )}

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-900 text-base">{item.code}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {item.length}m
                {item.color && item.color !== 'default' ? ` • ${item.color}` : ''}
              </p>
            </div>
            <button
              onClick={() => onRemove(item.profileId, item.color, item.length)}
              className="text-gray-300 hover:text-red-500 transition-colors p-1 shrink-0"
              title={isRtl ? 'הסר' : 'Remove'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Price per unit */}
          {item.pricePerPiece > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              {isRtl ? 'מחיר ליחידה:' : 'Unit price:'}{' '}
              <span className="font-semibold text-gray-700">₪{item.pricePerPiece.toFixed(2)}</span>
            </p>
          )}

          {/* Quantity + line total */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <button
                onClick={() => onUpdateQuantity(item.profileId, item.color, item.length, item.quantity - 1)}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-700 font-bold"
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
              <button
                onClick={() => onUpdateQuantity(item.profileId, item.color, item.length, item.quantity + 1)}
                className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-700 font-bold"
              >
                +
              </button>
            </div>

            {lineTotal > 0 && (
              <span className="text-base font-bold text-gray-900">
                ₪{lineTotal.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
