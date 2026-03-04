'use client'

import { CartItem } from '@/lib/cart-store'
import { getTranslation, type Locale } from '@/lib/locales'

interface CartSummaryProps {
  items: CartItem[]
  locale: Locale
}

export function CartSummary({ items, locale }: CartSummaryProps) {
  const isRtl = locale === 'he'
  const totalPrice = items.reduce((sum, item) => sum + item.pricePerPiece * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const hasPrices = totalPrice > 0

  return (
    <div
      className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b-2 border-brand">
        <h2 className="text-base font-bold text-white">
          {getTranslation(locale, 'cart.total')}
        </h2>
      </div>

      <div className="p-4 space-y-3">
        {/* Item lines */}
        <div className="space-y-2">
          {items.map((item) => {
            const lineTotal = item.pricePerPiece * item.quantity
            return (
              <div
                key={`${item.profileId}-${item.color}-${item.length}`}
                className="flex justify-between text-sm"
              >
                <span className="text-gray-600 truncate max-w-[160px]">
                  {item.code} × {item.quantity} ({item.length}m)
                </span>
                {lineTotal > 0 && (
                  <span className="font-semibold text-gray-900 shrink-0 ml-2">
                    ₪{lineTotal.toFixed(2)}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{isRtl ? 'סה"כ פריטים:' : 'Total items:'}</span>
            <span className="font-semibold text-gray-900">{totalItems}</span>
          </div>

          {hasPrices && (
            <div className="flex justify-between text-base font-bold mt-1">
              <span className="text-gray-800">{isRtl ? 'סה"כ לתשלום:' : 'Total:'}</span>
              <span className="text-brand text-lg">₪{totalPrice.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
