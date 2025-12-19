import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import { getGalleryImages } from '@/lib/gallery/get-gallery-images'
import rails from '@/data/gallery/rails.json'
import ContactSection from '@/components/contact-section'
import ArticleModal from '@/components/articleModal'

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  // Fetch directly from database (more reliable in production)
  const dbItems = await getGalleryImages('rails', { limit: 100 })
  const staticItems = (rails as { items: { src: string; type: 'image' | 'video' }[] }).items
  const items = dbItems.length > 0 ? dbItems : staticItems
  
  return (
    <main className="container py-16">
      <ArticleModal articleSlug="glass-railings" lang={locale} />
      <h1 className="text-3xl font-extrabold">{t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')}</h1>
      <ContactSection locale={locale}/>
     <MediaGallery title={t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')} items={items} />
    </main>
  )
}



