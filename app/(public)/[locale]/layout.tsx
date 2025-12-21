import '../../globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import Navbar from '@/components/navbar'
import UTMTracker from '@/components/utm-tracker'
import { Locale, isRTL } from '@/lib/locales'
import clsx from 'clsx'
import { Analytics } from "@vercel/analytics/react"
import { GoogleAnalytics } from '@/components/google-analytics'
import GA from '@/components/ga'
import { Suspense } from 'react'
import FloatingWhatsApp from '@/components/contact/FloatingWhatsApp'
import { ChatWidget } from '@/components/ai-chat/ChatWidget'

export const metadata: Metadata = {
  metadataBase: new URL('https://pashkovsky-group.com'),
  title: {
    default: 'Pashkovsky Group | פרגולות ומעקות אלומיניום בישראל',
    template: '%s | Pashkovsky Group',
  },
  description:
    'מאז 2019 Pashkovski Group מתמחה בייצור והתקנה של פרגולות, מעקות ומסתורים באיכות הגבוהה ביותר בישראל. ייצור מקומי, עיצוב יוקרתי ושירות אישי.',
  keywords: [
    'פרגולות אלומיניום', 'מעקות זכוכית', 'מסתורי כביסה',
    'Pergolas Israel', 'Pashkovski Group', 'אלומיניום איכותי', 'פרגולות חשמליות'
  ],
  authors: [{ name: 'Pashkovsky Group', url: 'https://pashkovsky-group.com' }],
  openGraph: {
    title: 'Pashkovsky Group | פרגולות ומעקות אלומיניום',
    description: 'פרגולות אלומיניום, מעקות ומסתורים בעיצוב יוקרתי וברמה הגבוהה בישראל.',
    url: 'https://pashkovsky-group.com',
    siteName: 'Pashkovsky-group.com',
    images: [
      {
        url: '/images/pergulot/ashkelon2/IMG_20240312_134433.webp',
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
    title: 'Pashkovsky Group',
    description: 'פרגולות ומעקות אלומיניום בישראל ברמה הגבוהה ביותר.',
  },
}

export default function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: Locale }
}) {
  const locale = params.locale
  const dir = isRTL(locale) ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} className={clsx('scroll-smooth')}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased">
        <Providers>
          <Suspense fallback={null}>
            <UTMTracker />
          </Suspense>
          
          <Navbar locale={locale} />
          
          {children}
          
          <FloatingWhatsApp />
          <ChatWidget />
          
          <Analytics />
          <GoogleAnalytics />
          <GA />
        </Providers>
      </body>
    </html>
  )
}
