'use client'

import { CartItem } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'

interface CartSummaryProps {
  items: CartItem[]
  locale: Locale
}

export function CartSummary({ items, locale }: CartSummaryProps) {
  const totalWeight = items.reduce((sum, item) => sum + item.weightPerPiece * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {getTranslation(locale, 'cart.total')}
      </h2>
      <div className="space-y-2 mb-4">
        {items.map((item) => (
          <div key={`${item.profileId}-${item.color}-${item.length}`} className="flex justify-between text-sm">
            <span className="text-gray-600">
              {item.code} × {item.quantity}
            </span>
            <span className="text-gray-900 font-medium">
              {(item.weightPerPiece * item.quantity).toFixed(3)} kg
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-3 space-y-1">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{locale === 'he' ? 'סה"כ פריטים:' : 'Total items:'}</span>
          <span className="font-medium text-gray-900">{totalItems}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>{locale === 'he' ? 'סה"כ משקל:' : 'Total weight:'}</span>
          <span className="text-gray-900">{totalWeight.toFixed(3)} kg</span>
        </div>
      </div>
    </div>
  )
}
