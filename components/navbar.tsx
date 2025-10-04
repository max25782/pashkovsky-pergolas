'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './theme-toggle'
import { Locale, locales } from '@/lib/locales'
import clsx from 'clsx'
import { useState } from 'react'

export default function Navbar({ locale }: { locale: Locale }){
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const tabs = [
    { href: `/${locale}`, label: locale==='he'?'דף הבית': locale==='ru'?'Главная':'Home' },
    { href: `/${locale}/about`, label: locale==='he'?'על החברה': locale==='ru'?'О компании':'About' },
    { href: `/${locale}#services`, label: locale==='he'?'השירותים שלנו': locale==='ru'?'Наши услуги':'Services' },
    { href: `/${locale}/contact`, label: locale==='he'?'צור קשר': locale==='ru'?'Контакты':'Contact' },
  ]

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 backdrop-blur bg-black/40">
      <div className="container flex items-center justify-between h-16">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-gradient-to-br from-brand-blue to-blue-600 grid place-items-center font-black">פ</div>
          <div className="leading-tight">
            <div className="font-extrabold text-sm">Pashkovskiy Group</div>
            <div className="text-xs text-white/60">אלומיניום. דיוק. חדשנות.</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map(t => (
              <Link key={t.href} href={t.href}
                className={clsx('px-3 py-2 rounded-xl text-sm font-semibold transition',
                  pathname === t.href ? 'bg-white/10' : 'hover:bg-white/5')}>
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-1 ml-2">
            {locales.map(l => (
              <Link key={l} href={`/${l}`} className={clsx(
                'px-2.5 py-1.5 rounded-full text-xs font-bold border',
                pathname?.startsWith(`/${l}`) ? 'bg-white text-black border-white' : 'border-white/20 text-white/70 hover:text-white'
              )}>{l.toUpperCase()}</Link>
            ))}
          </div>
          <div className="hidden md:block"><ThemeToggle /></div>

          {/* Mobile hamburger */}
          <button aria-label="Menu" aria-expanded={open} onClick={()=> setOpen(o=>!o)} className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-black/90 backdrop-blur">
          <div className="container py-3">
            <nav className="flex flex-col gap-1">
              {tabs.map(t => (
                <Link key={t.href} href={t.href} onClick={()=> setOpen(false)} className={clsx('px-3 py-2 rounded-xl text-sm font-semibold', pathname === t.href ? 'bg-white/10' : 'hover:bg-white/5')}>
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 mt-3">
              {locales.map(l => (
                <Link key={l} href={`/${l}`} onClick={()=> setOpen(false)} className={clsx('px-2.5 py-1.5 rounded-full text-xs font-bold border', pathname?.startsWith(`/${l}`) ? 'bg-white text-black border-white' : 'border-white/20 text-white/70 hover:text-white')}>
                  {l.toUpperCase()}
                </Link>
              ))}
              <div className="ml-auto"><ThemeToggle /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
