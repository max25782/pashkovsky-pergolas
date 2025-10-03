import '../globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import Navbar from '@/components/navbar'
import { Locale, isRTL } from '@/lib/locales'
import clsx from 'clsx'

export const metadata: Metadata = {
  title: 'פשקובסקי מעקות ופרגולות',
  description: 'פרגולות אלומיניום פרימיום בהתאמה אישית',
  metadataBase: new URL('https://pashkovsky-pergolas.vercel.app'),
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children, params: { locale } }: { children: React.ReactNode; params: { locale: Locale }}) {
  const dir = isRTL(locale) ? 'rtl' : 'ltr'
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      </head>
      <body className={clsx('min-h-screen', dir==='rtl'?'rtl':'ltr')}>
        <ThemeProvider attribute='class' defaultTheme='dark' enableSystem={false}>
          <Navbar locale={locale} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
