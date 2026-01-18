import { NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

// Server-only config (do NOT use NEXT_PUBLIC_* here)
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'eu-north-1'
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY

function getS3Client() {
  if (!S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.error('[from-shetah API] Missing AWS credentials:', {
      bucket: !!S3_BUCKET,
      accessKey: !!AWS_ACCESS_KEY_ID,
      secretKey: !!AWS_SECRET_ACCESS_KEY,
    })
    return null
  }

  console.log('[from-shetah API] Using AWS config:', {
    bucket: S3_BUCKET,
    region: S3_REGION,
    accessKeyPrefix: `${AWS_ACCESS_KEY_ID.slice(0, 4)}***`,
  })

  return new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  })
}

export async function GET() {
  const s3Client = getS3Client()

  if (!s3Client || !S3_BUCKET) {
    console.warn('[from-shetah API] S3 not configured, returning empty array')
    return NextResponse.json({ items: [] }, { status: 200 })
  }

  try {
    const prefix = 'images/fromShetah/'
    console.log(`[from-shetah API] Listing S3 objects: bucket=${S3_BUCKET}, prefix=${prefix}`)

    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []

    console.log(`[from-shetah API] S3 returned ${contents.length} objects`)

    const items: MediaItem[] = contents
      .filter(item => {
        const key = item.Key || ''
        return /\.(webp|jpg|jpeg|png|gif|mp4|webm|mov)$/i.test(key)
      })
      .map(item => {
        const url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${item.Key}`
        const isVideo = /\.(mp4|webm|mov)$/i.test(item.Key || '')
        
        return {
          src: url,
          type: (isVideo ? 'video' : 'image') as 'video' | 'image'
        }
      })
      .sort((a, b) => a.src.localeCompare(b.src))

    console.log(`[from-shetah API] Returning ${items.length} items`)

    return NextResponse.json({ items }, { status: 200 })
  } catch (error: any) {
    const debug = {
      name: error?.name,
      message: error?.message,
      code: error?.code || error?.Code,
      httpStatusCode: error?.$metadata?.httpStatusCode,
      requestId: error?.$metadata?.requestId,
    }

    console.error('[from-shetah API] Error:', debug)

    // Keep status 200 for safe fallback behavior; include debug in dev only
    return NextResponse.json(
      {
        items: [],
        ...(process.env.NODE_ENV !== 'production' ? { debug } : {}),
      },
      { status: 200 }
    )
  }
}

