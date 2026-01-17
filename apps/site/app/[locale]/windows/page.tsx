import type { Locale } from '@/lib/locales'
import { MediaGallery } from '@/components/generic/MediaGallery'
import ArticleModal from '@/components/articleModal'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import windowsData from '@/data/gallery/windows.json'

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

async function getWindowsImages(): Promise<MediaItem[]> {
  const s3Client = getS3Client()
  
  if (!S3_BUCKET || !s3Client) {
    console.log('[Windows] S3 not configured, using static data')
    return (windowsData as { items: MediaItem[] }).items || []
  }

  try {
    const prefix = 'images/windows/'
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
      console.log('[Windows] S3 returned 0 items, using static fallback')
      return (windowsData as { items: MediaItem[] }).items || []
    }

    return items
  } catch {
    return (windowsData as { items: MediaItem[] }).items || []
  }
}

export default async function Page({ params: { locale } }: { params: { locale: Locale } }) {
  const t = (he: string, ru: string, en: string) => (locale === 'he' ? he : locale === 'ru' ? ru : en)
  
  const items = await getWindowsImages()

  const titleHe = 'חלונות וויטרינות בהתאמה אישית'
  const descHe = 'יצור והתקנה של חלונות וויטרינות מאלומיניום לפי מידה ועיצוב אישי – פתרון אידיאלי למי שמחפש איכות בלתי מתפשרת, בידוד מושלם ומראה מודרני לאורך שנים.'
  const titleRu = 'Индивидуальные окна и витрины'
  const descRu = 'Производство и монтаж алюминиевых окон и витрин по вашим размерам и дизайну — идеальное решение для тех, кто ценит безупречное качество, отличную изоляцию и современный вид.'
  const titleEn = 'Custom Aluminum Windows & Storefronts'
  const descEn = 'Manufacture and installation of made‑to‑measure aluminum windows and storefronts — premium quality, excellent insulation, and a modern look that lasts.'

  return (
    <main className="container py-16">
      <ArticleModal articleSlug="windows-installation" lang={locale} />
      <h1 className="text-3xl font-extrabold">{t(titleHe, titleRu, titleEn)}</h1>
      <p className="mt-3 text-white/70">{t(descHe, descRu, descEn)}</p>
      <MediaGallery title={t(titleHe, titleRu, titleEn)} items={items} />
    </main>
  )
}
