'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Locale, locales } from '@/lib/locales'
import clsx from 'clsx'

function getNavLabels(locale: Locale) {
  if (locale === 'ru') {
    return {
      siteNav: 'Основная навигация',
      toggleMenu: 'Открыть меню',
      languageNav: 'Выбор языка',
    }
  }
  if (locale === 'en') {
    return {
      siteNav: 'Main navigation',
      toggleMenu: 'Toggle menu',
      languageNav: 'Language selection',
    }
  }
  return {
    siteNav: 'ניווט ראשי',
    toggleMenu: 'פתיחת תפריט',
    languageNav: 'בחירת שפה',
  }
}

export default function Navbar({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? ''
  const [isOpen, setIsOpen] = useState(false)
  const labels = getNavLabels(locale)

  const tabs = [
    { href: `/${locale}`, label: locale === 'he' ? 'דף הבית' : locale === 'ru' ? 'Главная' : 'Home' },
    { href: `/${locale}/about`, label: locale === 'he' ? 'על החברה' : locale === 'ru' ? 'О компании' : 'About' },
    { href: `/${locale}#services`, label: locale === 'he' ? 'השירותים שלנו' : locale === 'ru' ? 'Наши услуги' : 'Services' },
    { href: `/${locale}/profiles`, label: locale === 'he' ? 'פרופילים' : locale === 'ru' ? 'Профили' : 'Profiles' },
    { href: `/${locale}/blog`, label: locale === 'he' ? 'בלוג' : locale === 'ru' ? 'Блог' : 'Blog' },
    { href: `/${locale}/contact`, label: locale === 'he' ? 'צור קשר' : locale === 'ru' ? 'Контакты' : 'Contact' },
  ]

  return (
    <header className="no-print sticky top-0 z-50 min-h-16 border-b border-white/10 backdrop-blur bg-black/40">
      <div className="container flex items-center justify-between h-16 min-h-16">
        <Link href={`/${locale}`} className="flex items-center gap-2 shrink-0">
          <Image
            src="/logo-preview.png"
            alt="Pashkovsky Group"
            width={120}
            height={48}
            sizes="120px"
            priority
            className="object-contain h-10 sm:h-12 w-auto invert"
          />
          <div className="leading-tight hidden sm:block min-w-[120px]">
            <div className="font-extrabold text-sm text-white">פשקובסקי גרופ</div>
            <div className="text-xs text-white/70">אלומיניום. דיוק. חדשנות.</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <nav className="flex items-center gap-1" aria-label={labels.siteNav}>
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  'px-3 py-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  pathname === t.href ? 'bg-white/10' : 'hover:bg-white/5',
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <nav className="flex items-center gap-1 ms-2" aria-label={labels.languageNav}>
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}`}
                className={clsx(
                  'px-2.5 py-1.5 rounded-full text-xs font-bold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  pathname.startsWith(`/${l}`) ? 'bg-white text-black border-white' : 'border-white/20 text-white/80 hover:text-white',
                )}
              >
                {l.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-white hover:bg-white/10 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            aria-label={labels.toggleMenu}
            aria-expanded={isOpen}
            aria-controls="site-mobile-menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <div id="site-mobile-menu" className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur">
          <nav className="container py-4 flex flex-col gap-2" aria-label={labels.siteNav}>
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  'px-4 py-3 rounded-lg text-base font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  pathname === t.href ? 'bg-white/10' : 'hover:bg-white/5',
                )}
              >
                {t.label}
              </Link>
            ))}
            <div className="flex items-center gap-2 px-4 pt-2 border-t border-white/10 mt-2" role="group" aria-label={labels.languageNav}>
              {locales.map((l) => (
                <Link
                  key={l}
                  href={`/${l}`}
                  onClick={() => setIsOpen(false)}
                  className={clsx(
                    'px-3 py-2 rounded-full text-xs font-bold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                    pathname.startsWith(`/${l}`) ? 'bg-white text-black border-white' : 'border-white/20 text-white/80',
                  )}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
