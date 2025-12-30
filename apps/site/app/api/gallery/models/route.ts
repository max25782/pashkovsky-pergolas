import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getImageUrl } from '@/lib/image-url'

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || ''
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'

const s3Client = S3_BUCKET
  ? new S3Client({
      region: S3_REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    })
  : null

interface ModelItem {
  type: string
  degem: string
  images: string[]
}

// GET - Get models organized by subdirectory from S3
export async function GET(req: NextRequest) {
  try {
    // If S3 is not configured, return empty array (will use static data)
    if (!s3Client || !S3_BUCKET) {
      console.warn('[Models API] S3 not configured, returning empty array')
      return NextResponse.json({ items: [] })
    }

    // List all objects in images/dgamim/ prefix
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: 'images/dgamim/',
      Delimiter: '/',
    })

    const response = await s3Client.send(command)
    
    // Get all model folders (common prefixes)
    const modelFolders = response.CommonPrefixes?.map(prefix => prefix.Prefix) || []
    
    if (modelFolders.length === 0) {
      console.warn('[Models API] No model folders found in S3')
      return NextResponse.json({ items: [] })
    }

    // For each model folder, list images
    const modelGroups: Record<string, string[]> = {}

    for (const folderPrefix of modelFolders) {
      if (!folderPrefix) continue
      
      // Extract model name from path: images/dgamim/atlas/ -> atlas
      const modelName = folderPrefix.replace('images/dgamim/', '').replace('/', '')
      
      if (!modelName) continue

      // List images in this model folder
      const imagesCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: folderPrefix,
      })

      const imagesResponse = await s3Client.send(imagesCommand)
      const images = imagesResponse.Contents?.map(obj => {
        if (!obj.Key) return null
        // Convert S3 key to S3 URL
        const s3Url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${obj.Key}`
        return s3Url
      }).filter(Boolean) as string[] || []

      if (images.length > 0) {
        modelGroups[modelName] = images.sort()
      }
    }

    // Convert to array format expected by carousel
    const items: ModelItem[] = Object.entries(modelGroups)
      .map(([modelName, images]) => ({
        type: 'pergola',
        degem: modelName,
        images: images.sort(),
      }))
      .sort((a, b) => a.degem.localeCompare(b.degem))

    console.log(`[Models API] Returning ${items.length} models from S3`)

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[Models API] Unexpected error:', error)
    // Return empty array on error (will use static data as fallback)
    return NextResponse.json({ items: [] })
  }
}
