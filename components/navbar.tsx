'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Locale, locales } from '@/lib/locales'
import clsx from 'clsx'

export default function Navbar({ locale }: { locale: Locale }){
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  
  const tabs = [
    { href: `/${locale}`, label: locale==='he'?'דף הבית': locale==='ru'?'Главная':'Home' },
    { href: `/${locale}/about`, label: locale==='he'?'על החברה': locale==='ru'?'О компании':'About' },
    { href: `/${locale}#services`, label: locale==='he'?'השירותים שלנו': locale==='ru'?'Наши услуги':'Services' },
    { href: `/${locale}/profiles`, label: locale==='he'?'פרופילים': locale==='ru'?'Профили':'Profiles' },
    { href: `/${locale}/blog`, label: locale==='he'?'בלוג': locale==='ru'?'Блог':'Blog' },
    { href: `/${locale}/contact`, label: locale==='he'?'צור קשר': locale==='ru'?'Контакты':'Contact' },
  ]

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 backdrop-blur bg-black/40">
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <Image
            src="/logo-preview.png"
            alt="Pashkovsky Group"
            width={120}
            height={48}
            sizes="120px"
            priority
            className="object-contain h-[150px] w-auto invert"
          />
          <div className="leading-tight hidden sm:block">
            <div className="font-extrabold text-sm text-white">פשקובסקי גרופ</div>
            <div className="text-xs text-white/60">אלומיניום. דיוק. חדשנות.</div>
          </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-2">
          <nav className="flex items-center gap-1">
            {tabs.map(t => (
              <Link key={t.href} href={t.href}
                className={clsx('px-3 py-2 rounded-xl text-sm font-semibold transition',
                  pathname === t.href ? 'bg-white/10' : 'hover:bg-white/5')}>
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 ml-2">
            {locales.map(l => (
              <Link key={l} href={`/${l}`} className={clsx(
                'px-2.5 py-1.5 rounded-full text-xs font-bold border',
                pathname?.startsWith(`/${l}`) ? 'bg-white text-black border-white' : 'border-white/20 text-white/70 hover:text-white'
              )}>{l.toUpperCase()}</Link>
            ))}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 text-white hover:bg-white/10 rounded-lg transition"
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur">
          <nav className="container py-4 flex flex-col gap-2">
            {tabs.map(t => (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setIsOpen(false)}
                className={clsx('px-4 py-3 rounded-lg text-base font-semibold transition',
                  pathname === t.href ? 'bg-white/10' : 'hover:bg-white/5')}
              >
                {t.label}
              </Link>
            ))}
            <div className="flex items-center gap-2 px-4 pt-2 border-t border-white/10 mt-2">
              {locales.map(l => (
                <Link
                  key={l}
                  href={`/${l}`}
                  onClick={() => setIsOpen(false)}
                  className={clsx(
                    'px-3 py-2 rounded-full text-xs font-bold border',
                    pathname?.startsWith(`/${l}`) ? 'bg-white text-black border-white' : 'border-white/20 text-white/70'
                  )}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
