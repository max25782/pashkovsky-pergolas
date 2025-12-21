import type { Metadata } from 'next'
import { Noto_Sans_Hebrew } from 'next/font/google'
import '../globals.css'
import type { Locale } from '@/lib/locales'

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pashkovsky Group - פרגולות אלומיניום פרימיום',
  description: 'פרגולות אלומיניום פרימיום, גדרות, מעקות וחלונות',
}

export default function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: Locale }
}) {
  return (
    <html lang={params.locale} dir={params.locale === 'he' ? 'rtl' : 'ltr'}>
      <body className={notoSansHebrew.className}>
        {/* Public site navbar can be added here */}
        <main>{children}</main>
        {/* Public site footer can be added here */}
      </body>
    </html>
  )
}

