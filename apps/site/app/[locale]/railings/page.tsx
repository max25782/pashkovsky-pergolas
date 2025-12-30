import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import ContactSection from '@/components/contact-section'
import ArticleModal from '@/components/articleModal'

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

async function getRailsImages(): Promise<MediaItem[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (typeof window === 'undefined' ? 'http://localhost:3000' : '')
    const url = `${baseUrl}/api/gallery/rails`
    
    const response = await fetch(url, {
      next: { revalidate: 3600 }
    })
    
    if (!response.ok) {
      console.error('[Railings] API error:', response.status)
      return []
    }
    
    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('[Railings] Fetch error:', error)
    return []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  // Fetch directly from S3
  const items = await getRailsImages()
  
  return (
    <main className="container py-16">
      <ArticleModal articleSlug="glass-railings" lang={locale} />
      <h1 className="text-3xl font-extrabold">{t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')}</h1>
      <ContactSection locale={locale}/>
     <MediaGallery title={t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')} items={items} />
    </main>
  )
}



