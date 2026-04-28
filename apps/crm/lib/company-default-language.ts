import type { PdfLocale } from '@/lib/pdf/pdf-locale'

const PASHKOVSKY_GROUP_NORMALIZED = 'pashkovsky group'

/** Primary tenant: Hebrew UI/PDF when the user has not chosen a language in settings. */
export function isPashkovskyGroupPrimaryTenant(companyName: string | null | undefined): boolean {
  return (companyName ?? '').trim().toLowerCase() === PASHKOVSKY_GROUP_NORMALIZED
}

export function defaultCrmLanguageForCompany(companyName: string | null | undefined): 'he' | 'en' {
  return isPashkovskyGroupPrimaryTenant(companyName) ? 'he' : 'en'
}

export function defaultPdfLocaleForCompany(companyName: string | null | undefined): PdfLocale {
  return isPashkovskyGroupPrimaryTenant(companyName) ? 'he' : 'en'
}
