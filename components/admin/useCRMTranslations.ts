import { useParams } from 'next/navigation'
import type { Locale } from '@/lib/locales'
import { getCRMTranslations, type CRMTranslations } from '@/lib/admin-translations'

export function useCRMTranslations(): CRMTranslations {
  const params = useParams()
  const locale = (params?.locale as Locale) || 'he'
  return getCRMTranslations(locale)
}






