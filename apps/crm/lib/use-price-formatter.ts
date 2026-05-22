'use client'

import { useLanguage } from '@/lib/language-context'
import { formatPrice, LANGUAGE_CURRENCY } from '@/lib/offer-calculator'

export function usePriceFormatter() {
  const { language } = useLanguage()
  const { code, locale } = LANGUAGE_CURRENCY[language] ?? LANGUAGE_CURRENCY.he
  return (price: number) => formatPrice(price, code, locale)
}
