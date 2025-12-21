"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DealsTable } from '@/components/admin/DealsTable'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'

export default function AdminDealsPage() {
  const t = useCRMTranslations()
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [isJWT, setIsJWT] = useState(false)

  useEffect(() => {
    // Check for JWT token first (from login/register)
    const jwtToken = localStorage.getItem('token')
    if (jwtToken) {
      setToken(jwtToken)
      setIsJWT(true)
      return
    }

    // Fallback to admin token (legacy)
    const adminToken = localStorage.getItem('admin_token')
    if (adminToken) {
      setToken(adminToken)
      setIsJWT(false)
    }
  }, [])

  function save() {
    if (input.trim()) {
      localStorage.setItem('admin_token', input.trim())
      setToken(input.trim())
      setIsJWT(false)
    }
  }

  function logout() {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    setToken(null)
    setInput('')
    setIsJWT(false)
  }

  if (!token) {
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Admin • {t.deals.title}</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">{t.auth.enterAdminToken}</label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
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
        <h1 className="text-2xl font-bold">Admin • {t.deals.title}</h1>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/app/admin/deals"
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            {t.nav.deals}
          </Link>
          <Link
            href="/app/admin/statistics"
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold"
          >
            {t.nav.statistic}
          </Link>
          <Link
            href="/app/admin/leads"
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            {t.nav.leads}
          </Link>
          <Link
            href="/app/admin/gallery"
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            {t.nav.gallery}
          </Link>
          <Link
            href="/app/admin/ai-chats"
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold"
          >
            {t.nav.aiChats}
          </Link>
          <Link
            href="/app/admin/articles"
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold"
          >
            {t.nav.articles}
          </Link>
          <Link
            href="/app/admin/workers"
            className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold"
          >
            {t.nav.workers}
          </Link>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">
            {t.common.logout}
          </button>
        </div>
      </div>
      <DealsTable adminToken={token || ''} isJWT={isJWT} />
    </main>
  )
}

