import '../globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import Navbar from '@/components/navbar'
import UTMTracker from '@/components/utm-tracker'
import { Locale, isRTL } from '@/lib/locales'
import clsx from 'clsx'
import { Analytics } from "@vercel/analytics/react"
import GA from '@/components/ga'
import { Suspense } from 'react'

export const metadata: Metadata = {
  metadataBase: new URL('https://pashkovsky-group.com'),
  title: {
    default: 'Pashkovski Group | פרגולות ומעקות אלומיניום בישראל',
    template: '%s | Pashkovski Group',
  },
  description:
    'מאז 2019 Pashkovski Group מתמחה בייצור והתקנה של פרגולות, מעקות ומסתורים באיכות הגבוהה ביותר בישראל. ייצור מקומי, עיצוב יוקרתי ושירות אישי.',
  keywords: [
    'פרגולות אלומיניום', 'מעקות זכוכית', 'מסתורי כביסה',
    'Pergolas Israel', 'Pashkovski Group', 'אלומיניום איכותי', 'פרגולות חשמליות'
  ],
  authors: [{ name: 'Pashkovski Group', url: 'https://pashkovski.com' }],
  openGraph: {
    title: 'Pashkovski Group | פרגולות ומעקות אלומיניום',
    description: 'פרגולות אלומיניום, מעקות ומסתורים בעיצוב יוקרתי וברמה הגבוהה בישראל.',
    url: 'https://pashkovsky-group.com',
    siteName: 'Pashkovski Group',
    images: [
      {
        url: 'https://pashkovsky-group.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'פרגולות אלומיניום בעיצוב יוקרתי',
      },
    ],
    locale: 'he_IL',
    type: 'website',
  },
  alternates: {
    canonical: 'https://pashkovsky-group.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pashkovski Group',
    description: 'פרגולות ומעקות אלומיניום בישראל ברמה הגבוהה ביותר.',
    images: ['https://pashkovsky-group.com/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: Locale }}) {
  const dir = isRTL(locale) ? 'rtl' : 'ltr'
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        {/* Preload removed to avoid warnings on non-home pages; hero uses priority/fetchPriority */}
      </head>
      <body className={clsx(
        'min-h-screen transition-colors duration-200',
        'bg-white text-black dark:bg-neutral-950 dark:text-white',
        dir==='rtl'?'rtl':'ltr'
      )}>
        <Providers>
          <UTMTracker />
          <Suspense fallback={null}>
            <GA />
          </Suspense>
          <Suspense fallback={null}>
            <Navbar locale={locale} />
          </Suspense>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
