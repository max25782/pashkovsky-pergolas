'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  Target, 
  FileText, 
  BarChart3, 
  Settings,
  Menu,
  X,
  LogOut,
  Brain,
  Images,
} from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { LanguageSwitcher } from '@/components/admin/LanguageSwitcher'
import { useLanguage } from '@/lib/language-context'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

export default function CRMSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { language } = useLanguage()
  const t = useCRMTranslations()
  const [isOpen, setIsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  
  const isRTL = language === 'he'
  const sidePosition = isRTL ? 'right-0' : 'left-0'
  const borderSide = isRTL ? 'border-l' : 'border-r'

  const menuItems = [
    { href: '/app/admin', label: language === 'ru' ? 'Панель' : language === 'en' ? 'Dashboard' : 'לוח בקרה', icon: LayoutDashboard },
    { href: '/app/admin/ai-director', label: language === 'ru' ? 'AI-директор' : language === 'en' ? 'AI Director' : 'מנהל AI', icon: Brain },
    { href: '/app/admin/leads', label: t.nav.leads, icon: Target },
    { href: '/app/admin/deals', label: t.nav.deals, icon: FileText },
    { href: '/app/admin/users', label: language === 'ru' ? 'Пользователи' : language === 'en' ? 'Users' : 'משתמשים', icon: Users },
    { href: '/app/admin/statistics', label: t.nav.statistic, icon: BarChart3 },
    { href: '/app/admin/workers', label: t.nav.workers, icon: Users },
    { href: '/app/admin/media', label: language === 'ru' ? 'Медиа AI' : language === 'en' ? 'AI Media' : 'מדיה AI', icon: Images },
  ]

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      
      const supabase = createClient()
      
      // Sign out from Supabase Auth
      await supabase.auth.signOut()
      
      // Clear any old tokens from localStorage
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('admin_token')
      
      console.log('[Logout] Successfully logged out')
      
      // Redirect to login
      router.push('/login')
    } catch (error) {
      console.error('[Logout] Error:', error)
      // Still redirect even if there's an error
      router.push('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "fixed top-4 z-50 p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-lg lg:hidden",
          isRTL ? 'right-4' : 'left-4'
        )}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Hover Trigger Zone - Desktop only */}
      <div
        className={clsx(
          "hidden lg:block fixed inset-y-0 z-30 w-8",
          isRTL ? 'right-0' : 'left-0'
        )}
        onMouseEnter={() => setIsHovered(true)}
      />

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          'fixed inset-y-0 z-40 w-64 bg-gradient-to-b from-gray-900 to-gray-950 border-white/10 transition-all duration-300 ease-in-out shadow-2xl',
          borderSide,
          sidePosition,
          // Desktop: show on hover
          'hidden lg:block',
          isHovered ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full'),
          // Mobile: controlled by isOpen
          'lg:' + (isHovered ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full'))
        )}
        style={{
          [isRTL ? 'right' : 'left']: 0
        }}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link href="/app/admin" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
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
                  onClick={(e) => {
                    console.log('[CRMSidebar] Link clicked:', item.href)
                    console.log('[CRMSidebar] Current pathname:', pathname)
                    setIsOpen(false)
                    setIsHovered(false)
                  }}
                  className={clsx(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            {/* Language Switcher */}
            <div className="px-2 flex justify-center">
              <LanguageSwitcher />
            </div>
            
            <Link
              href="/app/admin/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <Settings size={20} />
              <span>{language === 'ru' ? 'Настройки' : language === 'en' ? 'Settings' : 'הגדרות'}</span>
            </Link>
            
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut size={20} />
              <span>
                {loggingOut 
                  ? (language === 'ru' ? 'Выход...' : language === 'en' ? 'Logging out...' : 'מתנתק...')
                  : (language === 'ru' ? 'Выход' : language === 'en' ? 'Logout' : 'התנתק')
                }
              </span>
            </button>
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
      
      {/* Mobile Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 z-40 w-64 bg-gradient-to-b from-gray-900 to-gray-950 border-white/10 transition-transform duration-300 shadow-2xl lg:hidden',
          borderSide,
          sidePosition,
          isOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')
        )}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo */}
          <div className="mb-8 text-center">
            <Link href="/app/admin" className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
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
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div className="px-2 flex justify-center">
              <LanguageSwitcher />
            </div>
            
            <Link
              href="/app/admin/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all"
            >
              <Settings size={20} />
              <span>{language === 'ru' ? 'Настройки' : language === 'en' ? 'Settings' : 'הגדרות'}</span>
            </Link>
            
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogOut size={20} />
              <span>
                {loggingOut 
                  ? (language === 'ru' ? 'Выход...' : language === 'en' ? 'Logging out...' : 'מתנתק...')
                  : (language === 'ru' ? 'Выход' : language === 'en' ? 'Logout' : 'התנתק')
                }
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

