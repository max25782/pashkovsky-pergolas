import type { Locale } from '@/lib/locales'
import { createTranslator } from '@/lib/locales'

export function SkipToMain({ locale }: { locale: Locale }) {
  const t = createTranslator(locale)
  const label = t('דלג לתוכן הראשי', 'Перейти к основному содержимому', 'Skip to main content')

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-neutral-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
    >
      {label}
    </a>
  )
}
