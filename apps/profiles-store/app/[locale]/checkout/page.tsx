'use client'

import { useState, FormEvent, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useCart, useCartHydrated } from '@/lib/cart-store'
import { submitOrder, fetchProfile } from '@/lib/api-client'
import { CheckoutForm } from '@/components/checkout/CheckoutForm'
import { OrderSummary } from '@/components/checkout/OrderSummary'
import { Container } from '@/components/layout/Container'
import { getTranslation, type Locale } from '@/lib/locales'
import { useToast } from '@/components/ui/toast'

export default function CheckoutPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const locale = (params.locale as Locale) || 'he'
  const companyId = searchParams.get('company_id') || process.env.NEXT_PUBLIC_COMPANY_ID
  const router = useRouter()
  const toast = useToast()
  const hydrated = useCartHydrated()
  const { items, clear, removeItem, addItem } = useCart()
  const patchedRef = useRef(false)

  // Patch stale items missing name fields
  useEffect(() => {
    if (!hydrated || patchedRef.current) return
    const staleItems = items.filter((i) => !i.nameHe && !i.nameRu && !i.nameEn)
    if (staleItems.length === 0) return
    patchedRef.current = true

    staleItems.forEach(async (item) => {
      try {
        const profile = await fetchProfile(item.profileId, companyId)
        const weightPerPiece = item.weightPerPiece || (profile.weight_per_meter || 0) * item.length
        removeItem(item.profileId, item.color, item.length)
        addItem(
          {
            profileId: item.profileId,
            code: item.code,
            nameHe: profile.name_he,
            nameRu: profile.name_ru,
            nameEn: profile.name_en,
            color: item.color,
            length: item.length,
            pricePerPiece: 0,
            weightPerPiece,
            imageUrl: item.imageUrl,
          },
          item.quantity
        )
      } catch (err) {
        console.error('[Checkout] Failed to patch stale cart item:', item.profileId, err)
        /* leave item as-is on fetch error — it will still appear in cart */
      }
    })
  }, [hydrated, items, removeItem, addItem, companyId])
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
      toast.error('Failed to submit order. Please try again.')
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
