'use client'

import { useState, FormEvent } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useCart } from '@/lib/cart-store'
import { submitOrder } from '@/lib/api-client'
import { CheckoutForm } from '@/components/checkout/CheckoutForm'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { Container } from '@/components/layout/Container'
import { getTranslation, type Locale } from '@/lib/locales'

export default function CheckoutPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = (params.locale as Locale) || 'he'
  const companyId = searchParams.get('company_id') || process.env.NEXT_PUBLIC_COMPANY_ID
  const router = useRouter()
  const { items, clear } = useCart()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const order = await submitOrder(
        {
          customer: customerInfo,
          items: items.map((item) => ({
            profile_id: item.profileId,
            color: item.color,
            length_meters: item.length,
            quantity_pieces: item.quantity,
            price_per_piece: item.pricePerPiece,
          })),
        },
        companyId
      )

      clear()
      router.push(`/${locale}/orders/${order.id}`)
    } catch (error) {
      console.error('Failed to submit order:', error)
      alert('Failed to submit order. Please try again.')
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    router.push(`/${locale}/cart`)
    return null
  }

  return (
    <Container className="py-12">
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            {getTranslation(locale, 'checkout.title')}
          </h1>

          <CheckoutForm
            locale={locale}
            customerInfo={customerInfo}
            onChange={setCustomerInfo}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
          <OrderSummary items={items} locale={locale} />
        </div>
      </div>
    </Container>
  )
}
