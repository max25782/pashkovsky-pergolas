'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'
import { createTranslator } from '@/lib/locales'

const STORAGE_KEY = 'pashkovsky_cookie_consent_v1'

export function CookieConsentBanner({ locale }: { locale: Locale }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const t = createTranslator(locale)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      /* private mode / blocked storage */
    }
    setVisible(true)
  }, [mounted])

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* still hide banner for session */
    }
    setVisible(false)
  }

  if (!mounted || !visible) return null

  const message = t(
    'על ידי שימוש באתר זה אתם מסכימים לשימוש בעוגיות שמסייעות לנו להפוך אותו לנוח יותר עבורכם.',
    'Используя данный сайт, вы даете согласие на использование файлов cookie, помогающих нам сделать его удобнее для вас.',
    'By using this site, you consent to cookies that help us make it more convenient for you.',
  )
  const learnMore = t('מידע נוסף', 'Подробнее', 'Learn more')
  const acceptLabel = t('אישור', 'Понятно', 'OK')
  const ariaLabel = t('הסכמה לעוגיות', 'Согласие на cookie', 'Cookie consent')

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={ariaLabel}
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      className="no-print fixed bottom-0 left-0 right-0 z-[100] border-t border-white/10 bg-neutral-900/95 px-4 py-3 text-sm text-white shadow-[0_-4px_24px_rgba(0,0,0,0.15)] backdrop-blur-sm sm:pr-28"
    >
      <div className="container mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="leading-relaxed text-white/95">
          {message}{' '}
          <Link
            href={`/${locale}/legal/privacy`}
            className="font-medium text-amber-300 underline-offset-2 hover:underline"
          >
            {learnMore}
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-amber-400"
        >
          {acceptLabel}
        </button>
      </div>
    </div>
  )
}
