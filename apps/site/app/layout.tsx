import './globals.css'
import type { Metadata } from 'next'
import Script from 'next/script'

export const metadata: Metadata = {
  metadataBase: new URL('https://pashkovsky-group.com'),
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
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
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

