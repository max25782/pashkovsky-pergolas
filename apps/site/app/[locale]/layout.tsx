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
import { OG_IMAGE_PATH, SITE_URL } from '@/lib/site-url'
import { StructuredData } from '@/components/seo/structured-data'
import { CookieConsentBanner } from '@/components/cookie-consent-banner'

const ChatWidget = dynamic(() => import('@/components/ai-chat/ChatWidget'), {
  ssr: false,
  loading: () => null,
})

// JPEG on S3 — WhatsApp/Facebook often skip WebP previews
const ogImageUrl = getOgImageUrl(OG_IMAGE_PATH)

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  authors: [{ name: 'Pashkovsky Group', url: SITE_URL }],
  openGraph: {
    title: 'Pashkovsky Group | פרגולות ומעקות אלומיניום',
    description: 'פרגולות אלומיניום, מעקות ומסתורים בעיצוב יוקרתי וברמה הגבוהה בישראל.',
    url: SITE_URL,
    siteName: 'Pashkovsky Group',
    images: [
      {
        url: ogImageUrl,
        type: 'image/jpeg',
        alt: 'פרגולות אלומיניום בעיצוב יוקרתי',
      },
    ],
    locale: 'he_IL',
    type: 'website',
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      he: `${SITE_URL}/he`,
      ru: `${SITE_URL}/ru`,
      en: `${SITE_URL}/en`,
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
