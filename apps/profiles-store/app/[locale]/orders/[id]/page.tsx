'use client'

import { Container } from '@/components/layout/Container'
import Link from 'next/link'
import { getTranslation, type Locale } from '@/lib/locales'
import { useParams } from 'next/navigation'

export default function OrderSuccessPage() {
  const params = useParams()
  const locale = (params.locale as Locale) || 'he'
  const id = params.id as string

  return (
    <Container className="py-12">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-8 h-8 text-white"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getTranslation(locale, 'order.success')}
          </h1>
          <p className="text-gray-600">
            {getTranslation(locale, 'order.number')}: {id}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">
            Thank you for your order! We will contact you shortly to confirm the details.
          </p>
          <Link
            href={`/${locale}`}
            className="inline-block px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </Container>
  )
}
