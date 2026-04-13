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
  Zap,
  Lock,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { LanguageSwitcher } from '@/components/admin/LanguageSwitcher'
import { useLanguage } from '@/lib/language-context'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useTranslations } from 'next-intl'
import { useSubscriptionPlan } from '@/components/subscription/subscription-plan-context'
import { minPlanForFeature } from '@/lib/subscription/plan-access'
import type { SaasFeature } from '@/lib/subscription/plan-types'

interface MenuItemConfig {
  href: string
  label: string
  icon: typeof LayoutDashboard
  feature: SaasFeature
  highlight?: boolean
}

export default function CRMSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { language } = useLanguage()
  const t = useCRMTranslations()
  const tNav = useTranslations('nav')
  const tSub = useTranslations('subscription')
  const { can } = useSubscriptionPlan()
  const [isOpen, setIsOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [companyName, setCompanyName] = useState<string>('AluminCRM')

  useEffect(() => {
    fetch('/api/companies/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.company_name) setCompanyName(data.company_name) })
      .catch(() => {})
  }, [])

  const isRTL = language === 'he'
  const sidePosition = isRTL ? 'right-0' : 'left-0'
  const borderSide = isRTL ? 'border-l' : 'border-r'
  const translateHidden = isRTL ? 'translate-x-full' : '-translate-x-full'

  const menuItems: MenuItemConfig[] = [
    { href: '/app/admin', label: tNav('dashboard'), icon: LayoutDashboard, feature: 'crm_home' },
    { href: '/app/quick-offer', label: tNav('quickOffer'), icon: Zap, feature: 'quick_offer', highlight: true },
    { href: '/app/admin/ai-director', label: tNav('aiDirector'), icon: Brain, feature: 'ai_director' },
    { href: '/app/admin/leads', label: t.nav.leads, icon: Target, feature: 'leads' },
    { href: '/app/admin/deals', label: t.nav.deals, icon: FileText, feature: 'deals' },
    { href: '/app/admin/users', label: tNav('users'), icon: Users, feature: 'clients' },
    { href: '/app/admin/statistics', label: t.nav.statistic, icon: BarChart3, feature: 'statistics' },
    { href: '/app/admin/workers', label: t.nav.workers, icon: Users, feature: 'workers' },
    { href: '/app/admin/media', label: tNav('aiMedia'), icon: Images, feature: 'ai_media' },
  ]

  const handleLogout = async () => {
    try {
      setLoggingOut(true)
      const supabase = createClient()
      await supabase.auth.signOut()
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('admin_token')
      router.push('/login')
    } catch {
      router.push('/login')
    } finally {
      setLoggingOut(false)
    }
  }

  const navContent = (
    <div className="flex flex-col h-full p-4">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/app/admin"
          onClick={() => setIsOpen(false)}
          className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
        >
          {companyName}
        </Link>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const unlocked = can(item.feature)
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const isHighlight = item.highlight === true
          const needPlan = minPlanForFeature(item.feature)
          const planLabel = tSub(`planNames.${needPlan}`)

          const className = clsx(
            'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full text-left',
            !unlocked && 'opacity-60 cursor-not-allowed',
            unlocked && isActive
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
              : unlocked && isHighlight
                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 hover:text-amber-200 border border-amber-500/30'
                : unlocked
                  ? 'text-gray-300 hover:bg-white/10 hover:text-white'
                  : 'text-gray-500',
          )

          if (!unlocked) {
            return (
              <div key={item.href} className="space-y-0.5">
                <div
                  role="group"
                  className={className}
                  aria-disabled
                  title={tSub('lockedNavHint', { plan: planLabel })}
                >
                  <Icon size={20} />
                  <span className="flex-1">{item.label}</span>
                  <Lock size={16} className="text-amber-500/90 shrink-0" aria-hidden />
                </div>
                <p className="px-4 text-[11px] text-amber-200/70 leading-tight">
                  {tSub('availableInPlan', { plan: planLabel })}
                </p>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={className}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="pt-4 border-t border-white/10 space-y-2">
        <div className="px-2 flex justify-center">
          <LanguageSwitcher />
        </div>
        <Link
          href="/app/admin/settings"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all"
        >
          <Settings size={20} />
          <span>{tNav('settings')}</span>
        </Link>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut size={20} />
          <span>{loggingOut ? tNav('loggingOut') : tNav('logout')}</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          'fixed top-4 z-50 p-2 bg-white/10 backdrop-blur rounded-lg shadow-lg hover:bg-white/20 transition-colors text-white',
          isRTL ? 'right-4' : 'left-4',
        )}
        aria-label={tNav('openMenu')}
      >
        <Menu size={22} />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 z-50 w-64 bg-gradient-to-b from-gray-900 to-gray-950 border-white/10 transition-transform duration-300 ease-in-out shadow-2xl',
          borderSide,
          sidePosition,
          isOpen ? 'translate-x-0' : translateHidden,
        )}
      >
        {navContent}
      </aside>
    </>
  )
}
