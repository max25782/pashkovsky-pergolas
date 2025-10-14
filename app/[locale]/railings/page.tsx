import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import rails from '@/data/gallery/rails.json'
import ContactSection from '@/components/contact-section'
import ArticleModal from '@/components/articleModal'

export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  const items = (rails as { items: { src: string; type: 'image' | 'video' }[] }).items
  return (
    <main className="container py-16">
      <ArticleModal articleSlug="glass-railings" lang={locale} />
      <h1 className="text-3xl font-extrabold">{t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')}</h1>
      <ContactSection locale={locale}/>
     <MediaGallery title={t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')} items={items} />
    </main>
  )
}



