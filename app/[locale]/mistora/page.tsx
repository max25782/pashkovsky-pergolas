import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import mestora from '@/data/gallery/mestor.json'
import ContactSection from '@/components/contact-section'
import ArticleModal from '@/components/articleModal'

async function fetchGalleryImages(categoryKey: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const res = await fetch(`${baseUrl}/api/gallery/images?category_key=${categoryKey}&limit=100`, {
      cache: 'no-store'
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.images || []).map((url: string) => ({ src: url, type: 'image' as const }))
  } catch (error) {
    console.warn(`[mistora page] fallback to static images, fetch error:`, error)
    return []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  // Try to fetch from Supabase Storage first, fallback to static JSON
  const apiItems = await fetchGalleryImages('mestor')
  const staticItems = (mestora as { items: { src: string; type: 'image' | 'video' }[] }).items
  const items = apiItems.length > 0 ? apiItems : staticItems
  
  return (
    <main className="container py-16">
      {/* ArticleModal articleSlug="laundry-screens" lang={locale} - нет статьи для mistora */}
      <h1 className="text-3xl font-extrabold">{t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')}</h1>
      <ContactSection locale={locale}/>
      <MediaGallery title={t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')} items={items} />
    </main>
  )
}



