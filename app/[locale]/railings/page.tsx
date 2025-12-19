import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import rails from '@/data/gallery/rails.json'
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
    console.warn(`[railings page] fallback to static images, fetch error:`, error)
    return []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  // Try to fetch from Supabase Storage first, fallback to static JSON
  const apiItems = await fetchGalleryImages('rails')
  const staticItems = (rails as { items: { src: string; type: 'image' | 'video' }[] }).items
  const items = apiItems.length > 0 ? apiItems : staticItems
  
  return (
    <main className="container py-16">
      <ArticleModal articleSlug="glass-railings" lang={locale} />
      <h1 className="text-3xl font-extrabold">{t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')}</h1>
      <ContactSection locale={locale}/>
     <MediaGallery title={t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')} items={items} />
    </main>
  )
}



