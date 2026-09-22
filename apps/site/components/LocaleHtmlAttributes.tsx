'use client'

import { useEffect } from 'react'
import type { Locale } from '@/lib/locales'

export function LocaleHtmlAttributes({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr'
    document.cookie = `site_locale=${locale};path=/;max-age=31536000;samesite=lax`
  }, [locale])

  return null
}
