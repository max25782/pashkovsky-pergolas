'use client'

import Image from 'next/image'
import { CartItem as CartItemType } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'

interface CartItemProps {
  item: CartItemType
  locale: Locale
  onUpdateQuantity: (profileId: string, color: string, length: number, quantity: number) => void
  onRemove: (profileId: string, color: string, length: number) => void
}

export function CartItem({ item, locale, onUpdateQuantity, onRemove }: CartItemProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 flex gap-4">
      {item.imageUrl && (
        <div className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
          <Image
            src={item.imageUrl}
            alt={item.code}
            fill
            className="object-contain"
            sizes="96px"
          />
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{item.code}</h3>
            <p className="text-sm text-gray-600">
              {item.color} • {item.length}m
            </p>
          </div>
          <button
            onClick={() => onRemove(item.profileId, item.color, item.length)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                onUpdateQuantity(item.profileId, item.color, item.length, item.quantity - 1)
              }
              className="w-8 h-8 flex items-center justify-center border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors"
            >
              -
            </button>
            <span className="w-12 text-center font-medium">{item.quantity}</span>
            <button
              onClick={() =>
                onUpdateQuantity(item.profileId, item.color, item.length, item.quantity + 1)
              }
              className="w-8 h-8 flex items-center justify-center border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
