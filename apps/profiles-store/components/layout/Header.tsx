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

  return (
    <header className="bg-neutral-950 border-b border-white/10 sticky top-0 z-50">
      <Container>
        <div className="py-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-white">Aluminum Profiles</h1>
            <CartWidget locale={locale} />
          </div>
          <nav className="flex gap-6">
            <Link
              href={`/${locale}`}
              className={cn(
                'text-base font-medium transition-colors',
                pathname === `/${locale}` || pathname === `/${locale}/`
                  ? 'text-primary underline'
                  : 'text-white/70 hover:text-white'
              )}
            >
              All Products
            </Link>
            <Link
              href={`/${locale}/cart`}
              className={cn(
                'text-base font-medium transition-colors',
                pathname === `/${locale}/cart`
                  ? 'text-primary underline'
                  : 'text-white/70 hover:text-white'
              )}
            >
              Cart
            </Link>
          </nav>
        </div>
      </Container>
    </header>
  )
}
