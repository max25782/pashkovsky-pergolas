import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import ContactSection from '@/components/contact-section'

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

async function getMestoraImages(): Promise<MediaItem[]> {
  try {
    // In server-side, use relative URL or localhost
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (typeof window === 'undefined' ? 'http://localhost:3000' : '')
    const url = `${baseUrl}/api/gallery/mestor`
    
    console.log('[Mistora] Fetching from:', url)
    
    const response = await fetch(url, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) {
      console.error('[Mistora] API error:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('[Mistora] Got items:', data.items?.length || 0)
    return data.items || []
  } catch (error) {
    console.error('[Mistora] Fetch error:', error)
    return []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  const items = await getMestoraImages()
  
  console.log('[Mistora Page] Rendering with items:', items.length)
  
  return (
    <main className="container py-16">
      {/* ArticleModal articleSlug="laundry-screens" lang={locale} - нет статьи для mistora */}
      <h1 className="text-3xl font-extrabold">{t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')}</h1>
      <ContactSection locale={locale}/>
      <MediaGallery title={t('מסתורי כביסה', 'Маскировка для прачечной', 'Laundry Screens')} items={items} />
    </main>
  )
}



