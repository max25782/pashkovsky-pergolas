'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useToast } from '@/components/ui/toast'
import { authFetch } from '@/lib/api/auth-fetch'
import { GalleryUploadTab } from '@/components/admin/gallery/GalleryUploadTab'
import { GalleryManageTab } from '@/components/admin/gallery/GalleryManageTab'
import { ProjectsTab } from '@/components/admin/gallery/ProjectsTab'
import type { GalleryCategory } from '@/components/admin/gallery/gallery-types'

type ViewMode = 'upload' | 'manage' | 'projects'

const TAB_CONFIG: Array<{ mode: ViewMode; label: string; activeClass: string }> = [
  { mode: 'upload', label: 'העלאת תמונות', activeClass: 'bg-blue-600' },
  { mode: 'manage', label: 'ניהול תמונות', activeClass: 'bg-red-600' },
  { mode: 'projects', label: 'פרויקטים', activeClass: 'bg-emerald-600' },
]

export default function GalleryAdminPage() {
  const t = useCRMTranslations()
  const toast = useToast()
  const [categories, setCategories] = useState<GalleryCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('upload')

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await authFetch('/admin-api/gallery/categories')
        if (!res.ok) throw new Error('Failed to fetch categories')
        const data = await res.json() as { data?: GalleryCategory[] }
        const cats = data.data ?? []
        setCategories(cats)
        if (cats.length > 0) setSelectedCategory(cats[0].key)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load categories'
        toast.error(message)
      }
    }
    loadCategories()
  }, [])

  return (
    <main className="container py-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Admin • {t.gallery.title}</h1>
        <nav className="flex gap-2 flex-wrap">
          <Link href="/app/admin/deals" className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold">
            {t.nav.deals}
          </Link>
          <Link href="/app/admin/statistics" className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 font-semibold">
            {t.nav.statistic}
          </Link>
          <Link href="/app/admin/leads" className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 font-semibold">
            {t.nav.leads}
          </Link>
          <Link href="/app/admin/ai-chats" className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-700 font-semibold">
            {t.nav.aiChats}
          </Link>
          <Link href="/app/admin/articles" className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 font-semibold">
            {t.nav.articles}
          </Link>
          <Link href="/app/admin/workers" className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold">
            {t.nav.workers}
          </Link>
        </nav>
      </div>

      <div className="flex gap-2 mb-4">
        {TAB_CONFIG.map(({ mode, label, activeClass }) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              viewMode === mode ? `${activeClass} text-white` : 'bg-white/10 text-white/70 hover:bg-white/20'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {viewMode === 'upload' && (
        <GalleryUploadTab
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      )}
      {viewMode === 'manage' && (
        <GalleryManageTab
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      )}
      {viewMode === 'projects' && <ProjectsTab />}
    </main>
  )
}
