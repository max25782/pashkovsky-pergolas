import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

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

  // Debug: Log configuration
  console.log(`[Gallery API] Request for category: ${category}`, {
    bucket: S3_BUCKET || 'NOT SET',
    region: S3_REGION,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
  })

  const s3Client = getS3Client()

  if (!S3_BUCKET || !s3Client) {
    console.error(`[Gallery API] S3 not configured for category ${category}:`, {
      bucket: S3_BUCKET,
      s3Client: !!s3Client,
      accessKey: !!process.env.AWS_ACCESS_KEY_ID,
      secretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    })
    return NextResponse.json({ items: [] })
  }

  try {
    const prefix = `images/${category}/`
    console.log(`[Gallery API] Listing S3 objects with prefix: ${prefix} in bucket: ${S3_BUCKET}`)
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix, // e.g., images/rails/, images/pergulot/
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []
    
    console.log(`[Gallery API] S3 Response for ${category}:`, {
      totalObjects: contents.length,
      isTruncated: response.IsTruncated,
      sampleKeys: contents.slice(0, 3).map(c => c.Key),
    })

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
          type: (isVideo ? 'video' : 'image') as 'video' | 'image'
        }
      })
      .sort((a, b) => a.src.localeCompare(b.src)) // Sort by name

    console.log(`[Gallery API] Returning ${items.length} items for ${category} from S3`)

    return NextResponse.json({ items })
  } catch (error: any) {
    console.error(`[Gallery API] Error fetching ${category} from S3:`, {
      error: error.message,
      code: error.Code,
      name: error.name,
    })
    
    // If it's an auth error and bucket is public, try to list known files
    if (error.Code === 'InvalidAccessKeyId' || error.Code === 'SignatureDoesNotMatch') {
      console.warn(`[Gallery API] Auth error - bucket might be public. Trying fallback...`)
      // Return empty array - client will use static data as fallback
    }
    
    return NextResponse.json({ items: [] })
  }
}

