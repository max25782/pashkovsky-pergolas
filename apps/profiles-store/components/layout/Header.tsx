'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Container } from './Container'
import { CartWidget } from '../cart/CartWidget'
import { type Locale } from '@/lib/locales'
import { cn } from '@/lib/cn'

interface HeaderProps {
  locale: Locale
}

export function Header({ locale }: HeaderProps) {
  const pathname = usePathname()

  const isRtl = locale === 'he'

  return (
    <header className="bg-gray-900 border-b-2 border-orange-400 sticky top-0 z-50" dir={isRtl ? 'rtl' : 'ltr'}>
      <Container>
        <div className="py-3 flex items-center justify-between gap-4">
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <span className="text-xl font-extrabold text-white tracking-tight">
              {isRtl ? 'פרופילי אלומיניום' : 'Aluminum Profiles'}
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            <Link
              href={`/${locale}`}
              className={cn(
                'text-sm font-medium transition-colors',
                pathname === `/${locale}` || pathname === `/${locale}/`
                  ? 'text-orange-400'
                  : 'text-white/70 hover:text-white'
              )}
            >
              {isRtl ? 'קטלוג' : 'Catalog'}
            </Link>
            <CartWidget locale={locale} />
          </nav>
        </div>
      </Container>
    </header>
  )
}
