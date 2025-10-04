import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import rails from '@/data/gallery/rails.json'

export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  const items = (rails as { items: { src: string; type: 'image' | 'video' }[] }).items
  return (
    <main className="container py-16">
      <h1 className="text-3xl font-extrabold">{t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')}</h1>
     <MediaGallery title={t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')} items={items} />
    </main>
  )
}



