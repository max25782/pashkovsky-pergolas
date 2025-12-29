'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { 
  Briefcase, 
  BarChart3, 
  Users, 
  Image as ImageIcon, 
  MessageSquare, 
  FileText, 
  UserCog,
  TrendingUp
} from 'lucide-react'

export default function AdminPage() {
  const t = useCRMTranslations()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const supabase = createClient()
      const { data: { user }, error } = await supabase.auth.getUser()
      
      console.log('[AdminPage] Checking auth...')
      console.log('[AdminPage] User:', user?.email || 'null')
      console.log('[AdminPage] Error:', error?.message || 'none')
      
      if (user) {
        setIsAuthenticated(true)
        setUserEmail(user.email || null)
      } else {
        console.log('[AdminPage] No authenticated user, redirecting to /login')
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
          <p className="text-white/60">Checking authentication...</p>
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
      description: 'ניהול עסקאות ופרויקטים',
      href: `/app/admin/deals`,
      icon: Briefcase,
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      id: 'statistic',
      title: t.nav.statistic,
      description: 'סטטיסטיקה וניתוח נתונים',
      href: `/app/admin/statistics`,
      icon: BarChart3,
      color: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
      id: 'leads',
      title: t.nav.leads,
      description: 'ניהול לידים ופניות',
      href: `/app/admin/leads`,
      icon: TrendingUp,
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      id: 'gallery',
      title: t.nav.gallery,
      description: 'ניהול גלריה ותמונות',
      href: `/app/admin/gallery`,
      icon: ImageIcon,
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      id: 'ai-chats',
      title: t.nav.aiChats,
      description: 'ניהול צ\'אטים AI',
      href: `/app/admin/ai-chats`,
      icon: MessageSquare,
      color: 'bg-cyan-600 hover:bg-cyan-700',
    },
    {
      id: 'articles',
      title: t.nav.articles,
      description: 'ניהול מאמרים',
      href: `/app/admin/articles`,
      icon: FileText,
      color: 'bg-indigo-600 hover:bg-indigo-700',
    },
    {
      id: 'workers',
      title: t.nav.workers,
      description: 'ניהול עובדים ומשמרות',
      href: `/app/admin/workers`,
      icon: UserCog,
      color: 'bg-yellow-600 hover:bg-yellow-700',
    },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 text-white">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Admin Panel</h1>
            <p className="text-white/60">פאנל ניהול - Pashkovsky Group</p>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition"
          >
            {t.common.logout}
          </button>
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

        {/* Quick Stats (optional) */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm text-white/60 mb-2">עסקאות פעילות</h3>
            <p className="text-3xl font-bold">—</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm text-white/60 mb-2">לידים חדשים</h3>
            <p className="text-3xl font-bold">—</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 className="text-sm text-white/60 mb-2">עובדים פעילים</h3>
            <p className="text-3xl font-bold">—</p>
          </div>
        </div>
      </div>
    </main>
  )
}
