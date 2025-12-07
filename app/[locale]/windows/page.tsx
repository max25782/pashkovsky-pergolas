import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import windows from '@/data/gallery/windows.json'
import ArticleModal from '@/components/articleModal'

async function fetchGallery(category: string, limit = 30) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  try {
    const res = await fetch(`${base}/api/gallery/images?category_key=${category}&limit=${limit}&random=true`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const data = await res.json()
    const urls: string[] = data.images || []
    return urls.map((src) => ({ src, type: 'image' as const }))
  } catch (e) {
    console.warn('[windows page] fallback to static images, fetch error:', e)
    return []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  const staticItems = (windows as { items: { src: string; type: 'image' | 'video' }[] }).items
  const dynamicImages = await fetchGallery('windows', 50)
  const items = [...dynamicImages, ...staticItems] // новые загрузки впереди, затем старые медиа

  const titleHe = 'חלונות וויטרינות בהתאמה אישית'
  const descHe = 'יצור והתקנה של חלונות וויטרינות מאלומיניום לפי מידה ועיצוב אישי – פתרון אידיאלי למי שמחפש איכות בלתי מתפשרת, בידוד מושלם ומראה מודרני לאורך שנים.'
  const titleRu = 'Индивидуальные окна и витрины'
  const descRu = 'Производство и монтаж алюминиевых окон и витрин по вашим размерам и дизайну — идеальное решение для тех, кто ценит безупречное качество, отличную изоляцию и современный вид.'
  const titleEn = 'Custom Aluminum Windows & Storefronts'
  const descEn = 'Manufacture and installation of made‑to‑measure aluminum windows and storefronts — premium quality, excellent insulation, and a modern look that lasts.'

  return (
    <main className="container py-16">
      <ArticleModal articleSlug="windows-installation" lang={locale} />
      <h1 className="text-3xl font-extrabold">{t(titleHe, titleRu, titleEn)}</h1>
      <p className="mt-3 text-white/70">{t(descHe, descRu, descEn)}</p>
      <MediaGallery title={t(titleHe, titleRu, titleEn)} items={items} />
    </main>
  )
}