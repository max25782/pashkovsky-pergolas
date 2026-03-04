'use client'

import { useEffect, useRef } from 'react'
import { useCart, useCartHydrated } from '@/lib/cart-store'
import { CartItem } from '@/components/cart/CartItem'
import { CartSummary } from '@/components/cart/CartSummary'
import { Container } from '@/components/layout/Container'
import Link from 'next/link'
import { getTranslation, type Locale } from '@/lib/locales'
import { useParams } from 'next/navigation'
import { fetchProfile } from '@/lib/api-client'

export default function CartPage() {
  const params = useParams()
  const locale = (params.locale as Locale) || 'he'
  const hydrated = useCartHydrated()
  const { items, updateQuantity, removeItem, addItem, clear } = useCart()
  const patchedRef = useRef(false)

  // Patch stale items that have weightPerPiece === 0 (saved before the field existed)
  useEffect(() => {
    if (!hydrated || patchedRef.current) return
    const staleItems = items.filter((i) => !i.weightPerPiece)
    if (staleItems.length === 0) return
    patchedRef.current = true

    const companyId = process.env.NEXT_PUBLIC_COMPANY_ID
    staleItems.forEach(async (item) => {
      try {
        const profile = await fetchProfile(item.profileId, companyId)
        const weightPerPiece = (profile.weight_per_meter || 0) * item.length
        removeItem(item.profileId, item.color, item.length)
        addItem(
          { profileId: item.profileId, code: item.code, color: item.color, length: item.length, pricePerPiece: 0, weightPerPiece, imageUrl: item.imageUrl },
          item.quantity
        )
      } catch { /* leave as-is on error */ }
    })
  }, [hydrated, items, removeItem, addItem])

  const isRtl = locale === 'he'

  if (!hydrated) {
    return (
      <Container className="py-12">
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-gray-700 rounded" />
          <div className="h-16 bg-gray-700 rounded" />
          <div className="h-16 bg-gray-700 rounded" />
        </div>
      </Container>
    )
  }

  if (items.length === 0) {
    return (
      <Container className="py-12">
        <h1 className="text-2xl font-bold text-white mb-6">
          {getTranslation(locale, 'cart.title')}
        </h1>
        <p className="text-gray-400 mb-6">{getTranslation(locale, 'cart.empty')}</p>
        <Link
          href={`/${locale}`}
          className="inline-block px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
        >
          {isRtl ? 'חזור לקטלוג' : 'Back to catalog'}
        </Link>
      </Container>
    )
  }

  return (
    <Container className="py-8">
      <div className="flex items-center justify-between mb-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <h1 className="text-2xl font-bold text-white">
          {getTranslation(locale, 'cart.title')}
        </h1>
        <button
          onClick={clear}
          className="text-sm text-gray-400 hover:text-red-400 transition-colors"
        >
          {isRtl ? 'נקה הכל' : 'Clear all'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700" dir={isRtl ? 'rtl' : 'ltr'}>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-gray-300 text-xs uppercase tracking-wide">
              <th className="py-3 px-3 text-right w-20">{/* image */}</th>
              <th className="py-3 px-3 text-right">{isRtl ? 'מק"ט' : 'Code'}</th>
              <th className="py-3 px-3 text-center">{isRtl ? 'יחידות' : 'Qty'}</th>
              <th className="py-3 px-3 text-center">{isRtl ? 'אורך ליחידה' : 'Length/unit'}</th>
              <th className="py-3 px-3 text-center">{isRtl ? 'אורך' : 'Total length'}</th>
              <th className="py-3 px-3 text-center">{isRtl ? 'משקל' : 'Weight'}</th>
              <th className="py-3 px-2 w-10">{/* remove */}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 bg-gray-900">
            {items.map((item) => (
              <CartItem
                key={`${item.profileId}-${item.color}-${item.length}`}
                item={item}
                locale={locale}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </tbody>
          <tfoot>
            <CartSummary items={items} locale={locale} />
          </tfoot>
        </table>
      </div>

      {/* Checkout button */}
      <div className="mt-6 flex justify-end" dir={isRtl ? 'rtl' : 'ltr'}>
        <Link
          href={`/${locale}/checkout`}
          className="px-10 py-4 bg-white hover:bg-gray-100 text-gray-900 font-extrabold rounded-lg transition-colors text-base shadow-lg"
        >
          {getTranslation(locale, 'cart.proceedToCheckout')}
        </Link>
      </div>
    </Container>
  )
}
