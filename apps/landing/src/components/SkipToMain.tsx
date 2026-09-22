'use client'

import { useTranslations } from 'next-intl'

export default function SkipToMain() {
  const t = useTranslations('accessibility')

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:start-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-neutral-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
    >
      {t('skipToContent')}
    </a>
  )
}
