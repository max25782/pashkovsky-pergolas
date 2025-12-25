'use client'

import { useEffect, useState } from 'react'
import { User, Building2, Bell, Shield, Palette } from 'lucide-react'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load user data from localStorage
    const token = localStorage.getItem('token') || localStorage.getItem('admin_token')
    if (token) {
      // In production, fetch user data from API
      // For now, just show placeholder
      setUser({ name: 'Admin User', email: 'admin@example.com' })
    }
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/70">טוען...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">הגדרות</h1>
          <p className="text-xl text-white/70">נהל את החשבון והעדפות המערכת שלך</p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-8 hover:bg-white/10 transition-all">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">פרופיל אישי</h2>
                <p className="text-white/60">ערוך את פרטי החשבון שלך</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">שם מלא</label>
                <input
                  type="text"
                  defaultValue={user?.name || ''}
                  className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="הזן שם מלא"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">אימייל</label>
                <input
                  type="email"
                  defaultValue={user?.email || ''}
                  className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  placeholder="הזן אימייל"
                />
              </div>
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">
                שמור שינויים
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
                <h2 className="text-2xl font-bold">הגדרות חברה</h2>
                <p className="text-white/60">נהל את פרטי החברה</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">שם החברה</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  placeholder="הזן שם חברה"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-2">תעשייה</label>
                <select className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-green-500 focus:outline-none">
                  <option value="pergola">פרגולות ואלומיניום</option>
                  <option value="construction">בנייה</option>
                  <option value="design">עיצוב</option>
                  <option value="other">אחר</option>
                </select>
              </div>
              <button className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors">
                שמור שינויים
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
                <h2 className="text-2xl font-bold">התראות</h2>
                <p className="text-white/60">התאם את העדפות ההתראות</p>
              </div>
            </div>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">התראות אימייל</span>
                <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">התראות לידים חדשים</span>
                <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-white">דיווחים שבועיים</span>
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
                <h2 className="text-2xl font-bold">אבטחה</h2>
                <p className="text-white/60">נהל הגדרות אבטחה</p>
              </div>
            </div>
            <div className="space-y-4">
              <button className="w-full px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg font-semibold transition-colors text-right">
                שנה סיסמה
              </button>
              <button className="w-full px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg font-semibold transition-colors text-right">
                התנתק מכל המכשירים
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
                <h2 className="text-2xl font-bold">מראה</h2>
                <p className="text-white/60">התאם את מראה המערכת</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-2">ערכת צבעים</label>
                <select className="w-full px-4 py-3 bg-black/30 border border-white/20 rounded-lg text-white focus:border-yellow-500 focus:outline-none">
                  <option value="dark">כהה (ברירת מחדל)</option>
                  <option value="light">בהיר</option>
                  <option value="auto">אוטומטי (לפי מערכת)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

