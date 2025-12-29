import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_CRM_URL || 'http://localhost:3001'),
  title: {
    default: 'Pashkovsky CRM',
    template: '%s | Pashkovsky CRM',
  },
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
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased bg-neutral-50 dark:bg-neutral-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
