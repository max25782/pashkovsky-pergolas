import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import { getGalleryImages } from '@/lib/gallery/get-gallery-images'
import mestora from '@/data/gallery/mestor.json'
import ContactSection from '@/components/contact-section'
import ArticleModal from '@/components/articleModal'

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  // Fetch directly from database (more reliable in production)
  const dbItems = await getGalleryImages('mestor', { limit: 100 })
  const staticItems = (mestora as { items: { src: string; type: 'image' | 'video' }[] }).items
  const items = dbItems.length > 0 ? dbItems : staticItems
  
  return (
    <main className="container py-16">
      {/* ArticleModal articleSlug="laundry-screens" lang={locale} - нет статьи для mistora */}
      <h1 className="text-3xl font-extrabold">{t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')}</h1>
      <ContactSection locale={locale}/>
      <MediaGallery title={t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')} items={items} />
    </main>
  )
}



