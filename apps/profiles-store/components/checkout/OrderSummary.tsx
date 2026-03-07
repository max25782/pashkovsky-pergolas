'use client'

import { CartItem } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'

interface OrderSummaryProps {
  items: CartItem[]
  locale: Locale
}

export function OrderSummary({ items, locale }: OrderSummaryProps) {
  const totalWeight = items.reduce((sum, item) => sum + item.weightPerPiece * item.quantity, 0)

  return (
    <div className="bg-gray-50 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {getTranslation(locale, 'cart.total')}
      </h2>
      <div className="space-y-3 mb-4">
        {items.map((item) => (
          <div
            key={`${item.profileId}-${item.color}-${item.length}`}
            className="flex justify-between text-sm"
          >
            <div>
              <span className="font-medium text-gray-900">
                {(locale === 'he' && item.nameHe) ||
                 (locale === 'ru' && item.nameRu) ||
                 item.nameEn || item.nameHe || item.nameRu || item.code}
              </span>
              <span className="text-gray-500 text-xs ml-1 font-mono">{item.code}</span>
              <span className="text-gray-600 ml-2">
                {item.color && item.color !== 'default' ? `${item.color} • ` : ''}{item.length}m × {item.quantity}
              </span>
            </div>
            <span className="text-gray-900 font-medium">
              {(item.weightPerPiece * item.quantity).toFixed(3)} kg
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 pt-3">
        <div className="flex justify-between text-base font-semibold text-gray-900">
          <span>{locale === 'he' ? 'סה"כ משקל:' : 'Total weight:'}</span>
          <span>{totalWeight.toFixed(3)} kg</span>
        </div>
      </div>
    </div>
  )
}
