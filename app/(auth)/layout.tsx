import type { Metadata } from 'next'
import { Noto_Sans_Hebrew } from 'next/font/google'
import '../globals.css'

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Authentication - Pashkovsky Group',
  description: 'Login to Pashkovsky CRM',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={notoSansHebrew.className}>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          {children}
        </div>
      </body>
    </html>
  )
}

