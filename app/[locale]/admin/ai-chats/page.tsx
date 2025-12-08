"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Locale } from '@/lib/locales'
import { AIChatsTable } from '@/components/admin/AIChatsTable'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

export default function AdminAIChatsPage({ params: { locale } }: { params: { locale: Locale } }) {
  const t = useCRMTranslations()
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token')
    if (storedToken) setToken(storedToken)
  }, [])

  function save() {
    if (input.trim()) {
      localStorage.setItem('admin_token', input.trim())
      setToken(input.trim())
    }
  }

  function logout() {
    localStorage.removeItem('admin_token')
    setToken(null)
    setInput('')
  }

  if (!token) {
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Admin • {t.aiChats.title}</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">{t.auth.enterAdminToken}</label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/20"
            placeholder={t.auth.adminTokenPlaceholder}
          />
          <button onClick={save} className="mt-3 px-4 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.continue}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.aiChats.title}</h1>
        <div className="flex gap-2">
          <Link
            href={`/${locale}/admin/leads`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href={`/${locale}/admin/deals`}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href={`/${locale}/admin/gallery`}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            {t.nav.gallery}
          </Link>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
          </button>
        </div>
      </div>
      <AIChatsTable adminToken={token} />
    </main>
  )
}


