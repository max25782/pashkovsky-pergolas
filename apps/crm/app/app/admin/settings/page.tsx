'use client'

import { useEffect, useState } from 'react'
import { User, Building2, Bell, Shield, Palette } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function SettingsPage() {
  const tSettings = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('admin_token')
    if (token) {
      setUser({ name: 'Admin User', email: 'admin@example.com' })
    }
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/70">{tSettings('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">{tSettings('title')}</h1>
          <p className="text-xl text-white/70">{tSettings('subtitle')}</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{tSettings('profile.title')}</h2>
                <p className="text-white/60">{tSettings('profile.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">{tSettings('profile.fullName')}</label>
                <input
                  type="text"
                  defaultValue={user?.name || ''}
                  className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder={tSettings('profile.fullNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">{tCommon('email')}</label>
                <input
                  type="email"
                  defaultValue={user?.email || ''}
                  className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder={tSettings('profile.emailPlaceholder')}
                />
              </div>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
                {tSettings('profile.save')}
              </button>
            </div>
          </div>

          {/* Company Section */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-green-500/20 rounded-xl">
                <Building2 className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{tSettings('company.title')}</h2>
                <p className="text-white/60">{tSettings('company.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">{tSettings('company.companyName')}</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder={tSettings('company.companyNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">{tSettings('company.industry')}</label>
                <select className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none">
                  <option value="pergola">{tSettings('company.industryPergola')}</option>
                  <option value="construction">{tSettings('company.industryConstruction')}</option>
                  <option value="design">{tSettings('company.industryDesign')}</option>
                  <option value="other">{tSettings('company.industryOther')}</option>
                </select>
              </div>
              <button className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors">
                {tSettings('company.save')}
              </button>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Bell className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{tSettings('notifications.title')}</h2>
                <p className="text-white/60">{tSettings('notifications.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">{tSettings('notifications.emailNotifications')}</span>
                <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">{tSettings('notifications.newLeadNotifications')}</span>
                <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">{tSettings('notifications.weeklyReports')}</span>
                <input type="checkbox" className="w-5 h-5 rounded" />
              </label>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-500/20 rounded-xl">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{tSettings('security.title')}</h2>
                <p className="text-white/60">{tSettings('security.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <button className="w-full px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg font-semibold transition-colors text-right">
                {tSettings('security.changePassword')}
              </button>
              <button className="w-full px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg font-semibold transition-colors text-right">
                {tSettings('security.logoutAll')}
              </button>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-yellow-500/20 rounded-xl">
                <Palette className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{tSettings('appearance.title')}</h2>
                <p className="text-white/60">{tSettings('appearance.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">{tSettings('appearance.colorScheme')}</label>
                <select className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-yellow-500 focus:outline-none">
                  <option value="dark">{tSettings('appearance.dark')}</option>
                  <option value="light">{tSettings('appearance.light')}</option>
                  <option value="auto">{tSettings('appearance.auto')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

