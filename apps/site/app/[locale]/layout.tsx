import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import Navbar from '@/components/navbar'
import UTMTracker from '@/components/utm-tracker'
import { Locale, isRTL } from '@/lib/locales'
import { Analytics } from "@vercel/analytics/react"
import { GoogleAnalytics } from '@/components/google-analytics'
import GA from '@/components/ga'
import { Suspense } from 'react'
import FloatingWhatsApp from '@/components/contact/FloatingWhatsApp'
import { ChatWidget } from '@/components/ai-chat/ChatWidget'
import { getOgImageUrl } from '@/lib/image-url'
import { StructuredData } from '@/components/seo/structured-data'

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

  return (
    <Providers>
      <StructuredData locale={locale} />
      <Suspense fallback={null}>
        <UTMTracker />
      </Suspense>
      
      <Navbar locale={locale} />
      
      {children}
      
      <ChatWidget />
      <FloatingWhatsApp />
      
      <Analytics />
      <GoogleAnalytics />
      <GA />
    </Providers>
  )
}
