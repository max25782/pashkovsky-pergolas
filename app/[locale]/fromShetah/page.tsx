import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import fromShetah from '@/data/gallery/fromShetah.json'

async function fetchGalleryImages(categoryKey: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/gallery/images?category_key=${categoryKey}&limit=100`, {
      cache: 'no-store'
    })
    if (!res.ok) return []
    const data = await res.json()
    // Use new format with type information if available, otherwise fall back to images array
    return data.items || (data.images || []).map((url: string) => ({ src: url, type: 'image' as const }))
  } catch (error) {
    console.warn(`[fromShetah page] fallback to static images, fetch error:`, error)
    return []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  // Try to fetch from S3 first, fallback to static JSON
  const apiItems = await fetchGalleryImages('fromShetah')
  const staticItems = (fromShetah as { items: { src: string; type: 'image' | 'video' }[] }).items
  const items = apiItems.length > 0 ? apiItems : staticItems
  
  return (
    <main className="container py-16">
      <h1 className="text-3xl font-extrabold">{t('מהשטח – רגעים אמיתיים מהעבודה שלנו', 'Работы с объектов', 'From the Field')}</h1>
      <h2 className="mt-3 text-white/70">{t("כאן זה קורה באמת – מאחורי הקלעים של כל פרויקט. רגעים של עבודה קשה, דיוק, יצירתיות וגם קצת צחוק. כי אצלנו כל פרגולה ומעקה נבנים עם מקצועיות ואהבה למה שאנחנו עושים.",
        'Реальные моменты с наших объектов — фото и видео с монтажа и производства.', 'Real moments from our sites — photos and videos from installs and production.')}</h2>
      <MediaGallery title={t('עבודות מהשטח', 'Работы с объектов', 'From the Field')} items={items} />
    </main>
  )
}
