import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import ContactSection from '@/components/contact-section'
import ArticleModal from '@/components/articleModal'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import railsData from '@/data/gallery/rails.json'

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'

function getS3Client() {
  if (!S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return null
  }
  
  return new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

async function getRailsImages(): Promise<MediaItem[]> {
  const s3Client = getS3Client()
  
  if (!S3_BUCKET || !s3Client) {
    console.log('[Railings] S3 not configured, using static data')
    return (railsData as { items: MediaItem[] }).items || []
  }

  try {
    const prefix = 'images/rails/'
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []

    const items: MediaItem[] = contents
      .filter(item => {
        const key = item.Key || ''
        return /\.(webp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(key)
      })
      .map(item => {
        const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${item.Key}`
        const isVideo = /\.(mp4|webm|mov|avi)$/i.test(item.Key || '')
        
        return {
          src: url,
          type: (isVideo ? 'video' : 'image') as 'video' | 'image'
        }
      })
      .sort((a, b) => a.src.localeCompare(b.src))

    // If S3 is empty, fallback to static data
    if (items.length === 0) {
      console.log('[Railings] S3 returned 0 items, using static fallback')
      return (railsData as { items: MediaItem[] }).items || []
    }

    return items
  } catch (error: any) {
    console.error('[Railings] Error fetching from S3:', error.message)
    return (railsData as { items: MediaItem[] }).items || []
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
