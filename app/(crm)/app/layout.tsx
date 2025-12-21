import '../../globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import CRMSidebar from '@/components/crm/CRMSidebar'
import { Suspense } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'CRM | Pashkovsky Group',
    template: '%s | CRM',
  },
  robots: {
    index: false, // Don't index CRM pages
    follow: false,
  },
}

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased bg-neutral-50 dark:bg-neutral-900">
        <Providers>
          <div className="flex min-h-screen">
            {/* CRM Sidebar */}
            <Suspense fallback={<div className="w-64 bg-white dark:bg-neutral-800" />}>
              <CRMSidebar />
            </Suspense>
            
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
