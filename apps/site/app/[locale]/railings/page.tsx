import { createTranslator } from '@/lib/locales'
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
    const staticItems = (railsData as { items: MediaItem[] }).items || []
    return staticItems
  }

  try {
    const prefix = 'images/rails/'
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []
    
    if (contents.length > 0) {
    }

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
      console.warn('[Railings] S3 returned 0 items, falling back to static data')
      const staticItems = (railsData as { items: MediaItem[] }).items || []
      return staticItems
    }

    return items
  } catch (error: unknown) {
    const e = error as Error & { Code?: string; code?: string; $metadata?: { httpStatusCode?: number; requestId?: string } }
    console.error('[Railings] Error fetching from S3:', {
      message: e?.message ?? String(error),
      code: e?.Code ?? e?.code,
      name: e?.name,
      httpStatusCode: e?.$metadata?.httpStatusCode,
      requestId: e?.$metadata?.requestId,
    })
    const staticItems = (railsData as { items: MediaItem[] }).items || []
    return staticItems
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = createTranslator(locale)
  
  // Fetch directly from S3
  const items = await getRailsImages()
  
  return (
    <main className="container py-16">
      <ArticleModal articleSlug="glass-railings" lang={locale} />
      <h1 className="text-3xl font-extrabold">{t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')}</h1>
      <ContactSection locale={locale} pageName="railings" />
     <MediaGallery title={t('מעקות אלומיניום בשלוב זכוכית', 'Перила из алюминия в сочетании с стеклом', 'Aluminum & Glass Railings')} items={items} />
    </main>
  )
}
