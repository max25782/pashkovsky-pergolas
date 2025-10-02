'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './theme-toggle'
import { Locale, locales } from '@/lib/locales'
import clsx from 'clsx'

export default function Navbar({ locale }: { locale: Locale }){
  const pathname = usePathname()
  const tabs = [
    { href: `/${locale}`, label: locale==='he'?'דף הבית': locale==='ru'?'Главная':'Home' },
    { href: `/${locale}/about`, label: locale==='he'?'על החברה': locale==='ru'?'О компании':'About' },
    { href: `/${locale}/models`, label: locale==='he'?'הדגמים של פרגולות שלנו': locale==='ru'?'Наши модели':'Models' },
    { href: `/${locale}#services`, label: locale==='he'?'השירותים שלנו': locale==='ru'?'Наши услуги':'Services' },
    { href: `/${locale}/contact`, label: locale==='he'?'צור קשר': locale==='ru'?'Контакты':'Contact' },
  ]

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 backdrop-blur bg-black/40">
      <div className="container flex items-center justify-between h-16">
        <Link href={`/${locale}`} className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-gradient-to-br from-brand-blue to-blue-600 grid place-items-center font-black">פ</div>
          <div className="leading-tight">
            <div className="font-extrabold text-sm">פשקובסקי מעקות ופרגולות</div>
            <div className="text-xs text-white/60">אלומיניום. דיוק. חדשנות.</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <nav className="hidden md:flex items-center gap-1">
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
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
