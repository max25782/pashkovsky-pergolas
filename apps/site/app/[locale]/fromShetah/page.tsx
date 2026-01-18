import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import fromShetahData from '@/data/gallery/fromShetah.json'
import { headers } from 'next/headers'

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

function getRequestBaseUrl(): string {
  const h = headers()
  const proto = h.get('x-forwarded-proto') || 'http'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

async function getFromShetahImages(): Promise<MediaItem[]> {
  try {
    // Fetch from API route (server-side only)
    const baseUrl = getRequestBaseUrl()
    const response = await fetch(`${baseUrl}/api/gallery/from-shetah`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      console.warn('[FromShetah Page] API returned', response.status, '- using static fallback')
      return (fromShetahData as { items: MediaItem[] }).items || []
    }

    const data = await response.json()
    const items = data.items || []

    // If API returns empty, fallback to static data
    if (items.length === 0) {
      console.log('[FromShetah Page] API returned 0 items, using static fallback')
      return (fromShetahData as { items: MediaItem[] }).items || []
    }

    console.log('[FromShetah Page] Loaded from API:', items.length, 'items')
    return items
  } catch (error: any) {
    console.error('[FromShetah Page] Error fetching from API:', error.message)
    return (fromShetahData as { items: MediaItem[] }).items || []
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
