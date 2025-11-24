"use client"
import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/locales'
import { LeadsTable } from '@/components/admin/LeadsTable'

export default function AdminLeadsPage({ params: { locale } }: { params: { locale: Locale } }){
  const [token, setToken] = useState<string | null>(null)
  const [input, setInput] = useState('')

  useEffect(()=>{
    const t = localStorage.getItem('admin_token')
    if (t) setToken(t)
  }, [])

  function save(){ if (input.trim()){ localStorage.setItem('admin_token', input.trim()); setToken(input.trim()) } }
  function logout(){ localStorage.removeItem('admin_token'); setToken(null); setInput('') }

  if (!token){
    return (
      <main className="container py-16 text-white">
        <h1 className="text-2xl font-bold mb-4">Admin • Leads</h1>
        <div className="max-w-md bg-white/5 border border-white/10 rounded-xl p-6">
          <label className="block text-sm mb-2">Enter admin token</label>
          <input value={input} onChange={e=> setInput(e.target.value)} className="w-full px-3 py-2 rounded bg-black/40 border border-white/20" placeholder="ADMIN_TOKEN" />
          <button onClick={save} className="mt-3 px-4 py-2 rounded bg-white/10 hover:bg-white/20">Continue</button>
        </div>
      </main>
    )
  }

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • Leads</h1>
        <div className="flex gap-2">
          <a 
            href={`/${locale}/admin/deals`}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
          >
            Сделки
          </a>
          <a 
            href={`/${locale}/admin/articles`}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            Статьи
          </a>
          <a
            href={`/${locale}/admin/gallery`}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 font-semibold"
          >
            Галерея
          </a>
          <button onClick={logout} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Logout</button>
        </div>
      </div>
      <LeadsTable adminToken={token} />
    </main>
  )
}


