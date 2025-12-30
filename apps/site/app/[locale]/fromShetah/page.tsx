import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

async function getFromShetahImages(): Promise<MediaItem[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (typeof window === 'undefined' ? 'http://localhost:3000' : '')
    const url = `${baseUrl}/api/gallery/fromShetah`
    
    const response = await fetch(url, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) return []
    const data = await response.json()
    return data.items || []
  } catch {
    return []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  const items = await getFromShetahImages()
  
  return (
    <main className="container py-16">
      <h1 className="text-3xl font-extrabold">{t('מהשטח – רגעים אמיתיים מהעבודה שלנו', 'Работы с объектов', 'From the Field')}</h1>
      <h2 className="mt-3 text-white/70">{t("כאן זה קורה באמת – מאחורי הקלעים של כל פרויקט. רגעים של עבודה קשה, דיוק, יצירתיות וגם קצת צחוק. כי אצלנו כל פרגולה ומעקה נבנים עם מקצועיות ואהבה למה שאנחנו עושים.",
        'Реальные моменты с наших объектов — фото и видео с монтажа и производства.', 'Real moments from our sites — photos and videos from installs and production.')}</h2>
      <MediaGallery title={t('עבודות מהשטח', 'Работы с объектов', 'From the Field')} items={items} />
    </main>
  )
}
