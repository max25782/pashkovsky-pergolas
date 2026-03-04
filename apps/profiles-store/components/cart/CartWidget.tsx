'use client'

import Link from 'next/link'
import { useCart } from '@/lib/cart-store'
import { type Locale } from '@/lib/locales'

interface CartWidgetProps {
  locale: Locale
}

export function CartWidget({ locale }: CartWidgetProps) {
  const cart = useCart()
  const itemCount = cart.totalItems()

  return (
    <Link
      href={`/${locale}/cart`}
      className="relative inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full font-bold text-sm transition-colors shadow border border-orange-400"
    >
      {/* Cart icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.2}
        stroke="currentColor"
        className="w-5 h-5 shrink-0"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
        />
      </svg>
      <span>{locale === 'he' ? 'הצעת מחיר' : 'Cart'}</span>
      {itemCount > 0 && (
        <span className="bg-orange-400 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none">
          {itemCount}
        </span>
      )}
    </Link>
  )
}
