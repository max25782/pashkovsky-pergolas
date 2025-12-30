import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'

const s3Client = S3_BUCKET && process.env.AWS_ACCESS_KEY_ID ? new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
}) : undefined

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

/**
 * GET /api/gallery/[category]
 * Fetch images directly from S3 for a specific category
 * 
 * Examples:
 * - /api/gallery/rails
 * - /api/gallery/pergulot
 * - /api/gallery/windows
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ category: string }> }
) {
  const params = await context.params
  const category = params.category

  if (!S3_BUCKET || !s3Client) {
    console.error(`[Gallery API] S3 not configured`)
    return NextResponse.json({ items: [] })
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: `images/${category}/`, // e.g., images/rails/, images/pergulot/
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []

    const items: MediaItem[] = contents
      .filter(item => {
        const key = item.Key || ''
        // Filter only media files
        return /\.(webp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(key)
      })
      .map(item => {
        const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${item.Key}`
        const isVideo = /\.(mp4|webm|mov|avi)$/i.test(item.Key || '')
        
        return {
          src: url,
          type: isVideo ? 'video' : 'image'
        }
      })
      .sort((a, b) => a.src.localeCompare(b.src)) // Sort by name

    console.log(`[Gallery API] Returning ${items.length} items for ${category} from S3`)

    return NextResponse.json({ items })
  } catch (error) {
    console.error(`[Gallery API] Error fetching ${category} from S3:`, error)
    return NextResponse.json({ items: [] })
  }
}

