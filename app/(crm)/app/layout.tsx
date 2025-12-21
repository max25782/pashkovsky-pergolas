import type { Metadata } from 'next'
import { Noto_Sans_Hebrew } from 'next/font/google'
import '../../globals.css'

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CRM - Pashkovsky Group',
  description: 'CRM System for Pashkovsky Group',
}

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={notoSansHebrew.className}>
        <div className="flex h-screen bg-gray-100">
          {/* CRM Sidebar will be added here */}
          <aside className="w-64 bg-white shadow-md">
            <div className="p-4">
              <h1 className="text-xl font-bold">CRM System</h1>
            </div>
            <nav className="mt-4">
              {/* Navigation items */}
              <a href="/app" className="block px-4 py-2 hover:bg-gray-100">
                Dashboard
              </a>
              <a href="/app/leads" className="block px-4 py-2 hover:bg-gray-100">
                Leads
              </a>
              <a href="/app/deals" className="block px-4 py-2 hover:bg-gray-100">
                Deals
              </a>
              <a href="/app/users" className="block px-4 py-2 hover:bg-gray-100">
                Users
              </a>
            </nav>
          </aside>
          
          {/* Main content */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}

