'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authFetch } from '@/lib/api/auth-fetch'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { LanguageSwitcher } from '@/components/admin/LanguageSwitcher'
import { useTranslations } from 'next-intl'
import { 
  Briefcase, 
  BarChart3, 
  Users, 
  Image as ImageIcon, 
  MessageSquare, 
  FileText, 
  UserCog,
  TrendingUp,
  Box,
  ShoppingCart,
  Package
} from 'lucide-react'

interface DashboardStats {
  activeDeals: number
  newLeads: number
  activeWorkers: number
}

export default function AdminPage() {
  const t = useCRMTranslations()
  const tAdmin = useTranslations('admin')
  const tNav = useTranslations('nav')
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    activeDeals: 0,
    newLeads: 0,
    activeWorkers: 0
  })

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadStats()
    }
  }, [isAuthenticated])

  async function loadStats() {
    try {
      const res = await authFetch('/api/admin/dashboard-stats')
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login?error=authentication_required'
          return
        }
        if (res.status === 404) {
          window.location.href = '/app/onboarding?error=no_company'
          return
        }
        console.error('[AdminPage] dashboard-stats error:', res.status)
        return
      }
      const data = await res.json()
      setStats({
        activeDeals: data.activeDeals ?? 0,
        newLeads: data.newLeads ?? 0,
        activeWorkers: data.activeWorkers ?? 0,
      })
    } catch (error) {
      console.error('[AdminPage] Error loading stats:', error)
    }
  }

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      
      if (user) {
        setIsAuthenticated(true)
        setUserEmail(user.email || null)
      } else {
        window.location.href = '/login'
      }
    } catch (err) {
      console.error('[AdminPage] Auth check error:', err)
      window.location.href = '/login'
    } finally {
      setIsChecking(false)
    }
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    localStorage.clear()
    window.location.href = '/login'
  }

  // Show loading while checking auth
  if (isChecking) {
    return (
      <main className="container py-16 text-white">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/60">{tAdmin('checkingAuth')}</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to /login
  }

  const adminSections = [
    {
      id: 'deals',
      title: t.nav.deals,
      description: t.deals.title,
      href: `/app/admin/deals`,
      icon: Briefcase,
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      id: 'statistic',
      title: t.nav.statistic,
      description: t.deals.statistics,
      href: `/app/admin/statistics`,
      icon: BarChart3,
      color: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
      id: 'leads',
      title: t.nav.leads,
      description: t.leads.title,
      href: `/app/admin/leads`,
      icon: TrendingUp,
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      id: 'gallery',
      title: t.nav.gallery,
      description: t.nav.gallery,
      href: `/app/admin/gallery`,
      icon: ImageIcon,
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      id: 'ai-chats',
      title: t.nav.aiChats,
      description: 'AI Chat Management',
      href: `/app/admin/ai-chats`,
      icon: MessageSquare,
      color: 'bg-cyan-600 hover:bg-cyan-700',
    },
    {
      id: 'articles',
      title: t.nav.articles,
      description: t.nav.articles,
      href: `/app/admin/articles`,
      icon: FileText,
      color: 'bg-indigo-600 hover:bg-indigo-700',
    },
    {
      id: 'workers',
      title: t.nav.workers,
      description: t.nav.workers,
      href: `/app/admin/workers`,
      icon: UserCog,
      color: 'bg-yellow-600 hover:bg-yellow-700',
    },
    {
      id: 'profiles',
      title: tNav('profiles'),
      description: tAdmin('profilesDescription'),
      href: `/app/profiles`,
      icon: Box,
      color: 'bg-orange-600 hover:bg-orange-700',
    },
    {
      id: 'orders',
      title: tNav('orders'),
      description: tAdmin('ordersDescription'),
      href: `/app/admin/orders`,
      icon: ShoppingCart,
      color: 'bg-pink-600 hover:bg-pink-700',
    },
    {
      id: 'inventory',
      title: tNav('inventory'),
      description: tAdmin('inventoryDescription'),
      href: `/app/admin/inventory`,
      icon: Package,
      color: 'bg-teal-600 hover:bg-teal-700',
    },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {tAdmin('title')}
            </h1>
            <p className="text-white/60">
              {tAdmin('subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition"
            >
              {t.common.logout}
            </button>
          </div>
        </div>

        {/* Admin Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section) => {
            const Icon = section.icon
            return (
              <Link
                key={section.id}
                href={section.href}
                className="group bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className={`${section.color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold mb-1 group-hover:text-blue-400 transition-colors">
                      {section.title}
                    </h2>
                    <p className="text-white/60 text-sm">{section.description}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 hover:bg-green-500/20 transition-colors">
            <h3 className="text-sm text-green-300 mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              {tAdmin('activeDeals')}
            </h3>
            <p className="text-3xl font-bold text-green-400">{stats.activeDeals}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 hover:bg-blue-500/20 transition-colors">
            <h3 className="text-sm text-blue-300 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              {tAdmin('newLeads')}
            </h3>
            <p className="text-3xl font-bold text-blue-400">{stats.newLeads}</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6 hover:bg-yellow-500/20 transition-colors">
            <h3 className="text-sm text-yellow-300 mb-2 flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              {tAdmin('activeWorkers')}
            </h3>
            <p className="text-3xl font-bold text-yellow-400">{stats.activeWorkers}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
