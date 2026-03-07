import '../globals.css'
import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import { Providers } from '@/components/providers'
import { Suspense } from 'react'

// CRMSidebar uses usePathname, useLanguage, createClient - defer to client to avoid hydration mismatch
const CRMSidebar = dynamic(() => import('@/components/crm/CRMSidebar'), { ssr: false })

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
    <Providers>
      <div className="flex min-h-screen">
        {/* CRM Sidebar - Only render if not on /app (which redirects immediately) */}
        <Suspense fallback={<div className="w-64 bg-white dark:bg-neutral-800" />}>
          <CRMSidebar />
        </Suspense>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </Providers>
  )
}
