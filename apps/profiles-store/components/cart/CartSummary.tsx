'use client'

import { CartItem } from '@/lib/cart-store'
import { formatPrice } from '@/lib/format'
import { getTranslation, type Locale } from '@/lib/locales'

interface CartSummaryProps {
  items: CartItem[]
  locale: Locale
}

export function CartSummary({ items, locale }: CartSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.pricePerPiece * item.quantity, 0)

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {getTranslation(locale, 'cart.total')}
      </h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.profileId}-${item.color}-${item.length}`} className="flex justify-between text-sm">
            <span className="text-gray-600">
              {item.code} × {item.quantity}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
