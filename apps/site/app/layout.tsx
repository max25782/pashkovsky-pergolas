import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'
import { cookies } from 'next/headers'
import { SITE_URL } from '@/lib/site-url'

const LOCALES = ['he', 'ru', 'en'] as const

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Pashkovsky Group | פרגולות ומעקות אלומיניום בישראל',
    template: '%s | Pashkovsky Group',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const localeCookie = cookies().get('site_locale')?.value
  const locale = LOCALES.includes(localeCookie as (typeof LOCALES)[number])
    ? (localeCookie as (typeof LOCALES)[number])
    : 'he'
  const isRtl = locale === 'he'

  return (
    <html lang={locale} dir={isRtl ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <meta name="facebook-domain-verification" content="84pmzynj4vxn26yjc163h1obz80f" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-17964444824"
          strategy="afterInteractive"
        />
        <Script id="google-ads" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17964444824');
          `}
        </Script>
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
