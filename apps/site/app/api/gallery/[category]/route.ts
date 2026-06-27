import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { galleryLimiter, checkLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'

function getS3Client() {
  if (!S3_BUCKET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return null
  }
  return new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
}

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

export async function GET(
  req: NextRequest,
  context: { params: { category: string } }
) {
  const { category } = context.params

  const ip = getClientIp(req)
  const rl = await checkLimit(galleryLimiter, ip)
  if (!rl.allowed) {
    return NextResponse.json(
      { items: [], error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const s3Client = getS3Client()

  if (!S3_BUCKET || !s3Client) {
    console.error(`[Gallery API] S3 not configured for category ${category}`)
    return NextResponse.json({ items: [] })
  }

  try {
    const prefix = `images/${category}/`

    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
    })

    const response = await s3Client.send(command)
    const contents = response.Contents ?? []

    const items: MediaItem[] = contents
      .filter((item) => /\.(webp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(item.Key ?? ''))
      .map((item) => {
        const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${item.Key}`
        const isVideo = /\.(mp4|webm|mov|avi)$/i.test(item.Key ?? '')
        return {
          src: url,
          type: (isVideo ? 'video' : 'image') as 'video' | 'image',
        }
      })
      .sort((a, b) => a.src.localeCompare(b.src))

    return NextResponse.json({ items })
  } catch (error) {
    console.error(`[Gallery API] Error fetching ${category} from S3:`, error)
    return NextResponse.json({ items: [] })
  }
}
