import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import fromShetahData from '@/data/gallery/fromShetah.json'

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

async function getFromShetahImages(): Promise<MediaItem[]> {
  const s3Client = getS3Client()
  
  if (!S3_BUCKET || !s3Client) {
    console.log('[FromShetah] S3 not configured, using static data')
    return (fromShetahData as { items: MediaItem[] }).items || []
  }

  try {
    const prefix = 'images/fromShetah/'
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
      console.log('[FromShetah] S3 returned 0 items, using static fallback')
      return (fromShetahData as { items: MediaItem[] }).items || []
    }

    return items
  } catch {
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
