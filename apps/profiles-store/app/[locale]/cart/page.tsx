'use client'

import { useCart } from '@/lib/cart-store'
import { CartItem } from '@/components/cart/CartItem'
import { CartSummary } from '@/components/cart/CartSummary'
import { Container } from '@/components/layout/Container'
import Link from 'next/link'
import { getTranslation, type Locale } from '@/lib/locales'
import { useParams } from 'next/navigation'

export default function CartPage() {
  const params = useParams()
  const locale = (params.locale as Locale) || 'he'
  const { items, updateQuantity, removeItem } = useCart()

  if (items.length === 0) {
    return (
      <Container className="py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          {getTranslation(locale, 'cart.title')}
        </h1>
        <p className="text-gray-600">{getTranslation(locale, 'cart.empty')}</p>
        <Link
          href={`/${locale}`}
          className="inline-block mt-4 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
        >
          Continue Shopping
        </Link>
      </Container>
    )
  }

  return (
    <Container className="py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        {getTranslation(locale, 'cart.title')}
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <CartItem
              key={`${item.profileId}-${item.color}-${item.length}`}
              item={item}
              locale={locale}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        <div>
          <CartSummary items={items} locale={locale} />
          <Link
            href={`/${locale}/checkout`}
            className="block w-full mt-4 px-6 py-3 bg-primary hover:bg-primary-dark text-white text-center rounded-lg font-medium transition-colors"
          >
            {getTranslation(locale, 'cart.proceedToCheckout')}
          </Link>
        </div>
      </div>
    </Container>
  )
}
