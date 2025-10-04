import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import mestora from '@/data/gallery/mestor.json'

export default function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  const items = (mestora as { items: { src: string; type: 'image' | 'video' }[] }).items
  return (
    <main className="container py-16">
      <h1 className="text-3xl font-extrabold">{t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')}</h1>
      <MediaGallery title={t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')} items={items} />
    </main>
  )
}



