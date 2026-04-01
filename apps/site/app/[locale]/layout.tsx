import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { headers } from 'next/headers'
import { Providers } from '@/components/providers'
import Navbar from '@/components/navbar'
import UTMTracker from '@/components/utm-tracker'
import type { Locale } from '@/lib/locales'
import { Analytics } from "@vercel/analytics/react"
import { GoogleAnalytics } from '@/components/google-analytics'
import GA from '@/components/ga'
import { Suspense } from 'react'
import FloatingWhatsApp from '@/components/contact/FloatingWhatsApp'
import { getOgImageUrl } from '@/lib/image-url'
import { StructuredData } from '@/components/seo/structured-data'
import { CookieConsentBanner } from '@/components/cookie-consent-banner'

const ChatWidget = dynamic(() => import('@/components/ai-chat/ChatWidget'), {
  ssr: false,
  loading: () => null,
})

// Generate absolute URL for Open Graph image
const ogImagePath = '/images/pergulot/ashkelon2/IMG_20240312_134433.webp'
const ogImageUrl = getOgImageUrl(ogImagePath)

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
        url: ogImageUrl,
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
    languages: {
      'he': 'https://pashkovsky-group.com/he',
      'ru': 'https://pashkovsky-group.com/ru',
      'en': 'https://pashkovsky-group.com/en',
    },
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pashkovsky Group',
    description: 'פרגולות ומעקות אלומיניום בישראל ברמה הגבוהה ביותר.',
    images: [ogImageUrl],
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
  const isCatalogPdf = headers().get('x-catalog-pdf-mode') === '1'

  return (
    <>
      {/* Outside client Providers so JSON-LD scripts never compete with next-themes' inline script (hydration). */}
      <StructuredData locale={locale} />
      <Providers>
        <Suspense fallback={null}>
          <UTMTracker />
        </Suspense>

        {!isCatalogPdf ? <Navbar locale={locale} /> : null}

        {children}

        {!isCatalogPdf ? <ChatWidget /> : null}
        {!isCatalogPdf ? <FloatingWhatsApp /> : null}
        {!isCatalogPdf ? <CookieConsentBanner locale={locale} /> : null}

        {!isCatalogPdf && process.env.NODE_ENV === 'production' ? (
          <>
            <Analytics />
            <GoogleAnalytics />
            <GA />
          </>
        ) : null}
      </Providers>
    </>
  )
}
