'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  FileText, 
  BarChart3, 
  Settings,
  Menu,
  X
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'

const menuItems = [
  { href: '/app/admin', label: 'לוח בקרה', icon: LayoutDashboard },
  { href: '/app/admin/leads', label: 'לידים', icon: Target },
  { href: '/app/admin/deals', label: 'עסקאות', icon: FileText },
  { href: '/app/admin/users', label: 'משתמשים', icon: Users },
  { href: '/app/admin/statistics', label: 'סטטיסטיקות', icon: BarChart3 },
  { href: '/app/admin/workers', label: 'עובדים', icon: Users },
]

export default function CRMSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-lg lg:hidden"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 right-0 z-40 w-64 bg-white dark:bg-neutral-800 border-l border-neutral-200 dark:border-neutral-700 transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link href="/app/admin" className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              Pashkovsky CRM
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <Link
              href="/app/admin/settings"
              className="flex items-center gap-3 px-4 py-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
            >
              <Settings size={20} />
              <span>הגדרות</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

