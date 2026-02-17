'use client'

import { ProfilesTable } from '@/components/admin/ProfilesTable'
import Link from 'next/link'

export default function ProfilesPage() {
  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Управление профилями</h1>
        <Link 
          href="/app/admin"
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 transition"
        >
          ← Назад
        </Link>
      </div>
      
      <ProfilesTable />
    </main>
  )
}

