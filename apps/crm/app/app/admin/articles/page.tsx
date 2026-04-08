'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCRMTranslations } from '@/components/admin/useCRMTranslations'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/toast'
import { authFetch } from '@/lib/api/auth-fetch'

interface Article {
  id: number
  slug: string
  title: { he: string; ru: string; en: string }
  summary: { he: string; ru: string; en: string }
  sections: Array<{
    heading: { he: string; ru: string; en: string }
    body: { he: string; ru: string; en: string }
  }>
}

export default function AdminArticlesPage() {
  const t = useCRMTranslations()
  const tArticles = useTranslations('articles')
  const toast = useToast()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load from Supabase API with authentication
      const response = await authFetch('/api/admin/articles')
      
      if (!response.ok) {
        throw new Error(`Failed to load articles: ${response.statusText}`)
      }
      
      const data = await response.json()
      setArticles(data.articles || data || [])
    } catch (error) {
      console.error('[Articles] Error loading:', error)
      setError(error instanceof Error ? error.message : 'Failed to load articles')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!editingArticle) return

    try {
      const response = await authFetch('/api/admin/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingArticle),
      })

      if (!response.ok) {
        throw new Error('Failed to save article')
      }

      toast.success(tArticles('saved'))
      loadArticles()
      setShowForm(false)
      setEditingArticle(null)
    } catch (error) {
      console.error('Error saving article:', error)
      toast.error(t.common.error)
    }
  }

  const handleDelete = async (slug: string) => {
    if (!confirm(t.articles.deleteConfirm)) return

    try {
      const response = await authFetch(`/api/admin/articles?slug=${slug}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete article')
      }

      toast.success(tArticles('deleted'))
      loadArticles()
    } catch (error) {
      console.error('Error deleting article:', error)
      toast.error(t.common.error)
    }
  }

  const createNewArticle = () => {
    const newArticle: Article = {
      id: Date.now(),
      slug: '',
      title: { he: '', ru: '', en: '' },
      summary: { he: '', ru: '', en: '' },
      sections: [],
    }
    setEditingArticle(newArticle)
    setShowForm(true)
  }

  const addSection = () => {
    if (!editingArticle) return
    setEditingArticle({
      ...editingArticle,
      sections: [
        ...editingArticle.sections,
        { heading: { he: '', ru: '', en: '' }, body: { he: '', ru: '', en: '' } },
      ],
    })
  }

  if (loading) return <div className="p-8 text-white">{t.common.loading}</div>

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-950 to-neutral-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin • {t.articles.title}</h1>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/app/admin/deals"
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
            >
              {t.nav.deals}
            </Link>
            <Link
              href="/app/admin/deals"
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
              href="/app/admin/workers"
              className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 font-semibold"
            >
              {t.nav.workers}
            </Link>
            <button
              onClick={createNewArticle}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 font-semibold"
            >
              + {t.articles.createArticle}
            </button>
          </div>
        </div>

        {!showForm ? (
          <div className="grid gap-4">
            {articles.map((article) => (
              <div key={article.slug} className="bg-white/5 rounded-lg p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold mb-2">{article.title.ru}</h2>
                    <p className="text-white/70 text-sm mb-2">Slug: {article.slug}</p>
                    <p className="text-white/60">{article.summary.ru.slice(0, 150)}...</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingArticle(article)
                        setShowForm(true)
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      {t.articles.editArticle}
                    </button>
                    <button
                      onClick={() => handleDelete(article.slug)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
                    >
                      {t.articles.deleteArticle}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/5 rounded-lg p-8">
            <h2 className="text-2xl font-bold mb-6">
              {editingArticle?.slug ? t.articles.editArticle : t.articles.createArticle}
            </h2>

            <div className="space-y-6">
              {/* Slug */}
              <div>
                <label className="block mb-2 font-semibold">{t.articles.slugLabel}</label>
                <input
                  type="text"
                  value={editingArticle?.slug || ''}
                  onChange={(e) =>
                    setEditingArticle({ ...editingArticle!, slug: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg"
                  placeholder="pergolas-aluminum"
                />
              </div>

              {/* Titles */}
              {(['he', 'ru', 'en'] as const).map((lang) => (
                <div key={`title-${lang}`}>
                  <label className="block mb-2 font-semibold">
                    {t.articles.titleLabel} ({lang.toUpperCase()})
                  </label>
                  <input
                    type="text"
                    value={editingArticle?.title[lang] || ''}
                    onChange={(e) =>
                      setEditingArticle({
                        ...editingArticle!,
                        title: { ...editingArticle!.title, [lang]: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg"
                  />
                </div>
              ))}

              {/* Summaries */}
              {(['he', 'ru', 'en'] as const).map((lang) => (
                <div key={`summary-${lang}`}>
                  <label className="block mb-2 font-semibold">
                    {tArticles('summaryLabel')} ({lang.toUpperCase()})
                  </label>
                  <textarea
                    value={editingArticle?.summary[lang] || ''}
                    onChange={(e) =>
                      setEditingArticle({
                        ...editingArticle!,
                        summary: { ...editingArticle!.summary, [lang]: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg"
                    rows={3}
                  />
                </div>
              ))}

              {/* Sections */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">{tArticles('sectionsLabel')}</h3>
                  <button
                    onClick={addSection}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    + {tArticles('addSection')}
                  </button>
                </div>

                {editingArticle?.sections.map((section, index) => (
                  <div key={index} className="mb-6 p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold">{tArticles('sectionLabel')} {index + 1}</h4>
                      <button
                        onClick={() => {
                          const newSections = [...editingArticle.sections]
                          newSections.splice(index, 1)
                          setEditingArticle({ ...editingArticle, sections: newSections })
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        {tArticles('deleteSection')}
                      </button>
                    </div>

                    {(['he', 'ru', 'en'] as const).map((lang) => (
                      <div key={`section-${index}-${lang}`} className="mb-4">
                        <label className="block mb-1 text-sm">
                          {tArticles('subheadingLabel')} ({lang.toUpperCase()})
                        </label>
                        <input
                          type="text"
                          value={section.heading[lang] || ''}
                          onChange={(e) => {
                            const newSections = [...editingArticle.sections]
                            newSections[index].heading[lang] = e.target.value
                            setEditingArticle({ ...editingArticle, sections: newSections })
                          }}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm"
                        />
                        <label className="block mb-1 mt-2 text-sm">
                          {tArticles('textLabel')} ({lang.toUpperCase()})
                        </label>
                        <textarea
                          value={section.body[lang] || ''}
                          onChange={(e) => {
                            const newSections = [...editingArticle.sections]
                            newSections[index].body[lang] = e.target.value
                            setEditingArticle({ ...editingArticle, sections: newSections })
                          }}
                          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-sm"
                          rows={4}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={handleSave}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold"
                >
                  {t.articles.save}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingArticle(null)
                  }}
                  className="px-8 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold"
                >
                  {t.articles.cancel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

