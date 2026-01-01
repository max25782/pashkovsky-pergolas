'use client'

import { useLanguage } from '@/lib/language-context'
import type { Locale } from '@/lib/locales'
import { getCRMTranslations, type CRMTranslations } from '@/lib/admin-translations'

export function useCRMTranslations(): CRMTranslations {
  const { language } = useLanguage()
  return getCRMTranslations(language as Locale)
}







