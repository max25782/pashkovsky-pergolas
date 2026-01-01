import './globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_CRM_URL || 'http://localhost:3001'),
  title: {
    default: 'AluminCRM - CRM для строительных компаний',
    template: '%s | AluminCRM',
  },
  description: 'Управляйте сделками, клиентами и проектами по алюминиевым конструкциям',
  applicationName: 'AluminCRM',
  keywords: ['CRM', 'pergola', 'aluminum', 'construction', 'алюминий', 'пергола'],
  robots: {
    index: false,
    follow: false,
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
        <link rel="icon" href="/logo-icon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased bg-neutral-50 dark:bg-neutral-900" suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
