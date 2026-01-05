import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getImageUrl } from '@/lib/image-url'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || ''
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

interface ModelItem {
  type: string
  degem: string
  images: string[]
}

// GET - Get models organized by subdirectory from S3
export async function GET(req: NextRequest) {
  try {
    // Debug: Log environment variables (without secrets)
    console.log('[Models API] S3 Configuration:', {
      bucket: S3_BUCKET || 'NOT SET',
      region: S3_REGION,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    })

    const s3Client = getS3Client()
    
    // If S3 is not configured, return empty array (will use static data)
    if (!s3Client || !S3_BUCKET) {
      console.warn('[Models API] S3 not configured:', {
        s3Client: !!s3Client,
        bucket: S3_BUCKET,
        accessKey: !!process.env.AWS_ACCESS_KEY_ID,
        secretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      })
      return NextResponse.json({ items: [] })
    }

    // List all objects in images/dgamim/ prefix
    const prefix = 'images/dgamim/'
    console.log(`[Models API] Listing S3 objects with prefix: ${prefix} in bucket: ${S3_BUCKET}`)
    
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      Delimiter: '/',
    })

    const response = await s3Client.send(command)
    
    console.log('[Models API] S3 Response:', {
      commonPrefixes: response.CommonPrefixes?.length || 0,
      contents: response.Contents?.length || 0,
      isTruncated: response.IsTruncated,
    })
    
    // Get all model folders (common prefixes)
    const modelFolders = response.CommonPrefixes?.map(prefix => prefix.Prefix) || []
    
    if (modelFolders.length === 0) {
      console.warn('[Models API] No model folders found in S3', {
        prefix,
        bucket: S3_BUCKET,
        hasContents: (response.Contents?.length || 0) > 0,
        contentsCount: response.Contents?.length || 0,
      })
      return NextResponse.json({ items: [] })
    }
    
    console.log(`[Models API] Found ${modelFolders.length} model folders:`, modelFolders)

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
  } catch (error: any) {
    console.error('[Models API] Unexpected error:', {
      error: error.message,
      code: error.Code,
      name: error.name,
      accessKeyId: error.AWSAccessKeyId,
    })
    
    // If it's an auth error, log it clearly
    if (error.Code === 'InvalidAccessKeyId' || error.Code === 'SignatureDoesNotMatch') {
      console.error('[Models API] AWS Authentication failed. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY')
    }
    
    // Return empty array on error (will use static data as fallback)
    return NextResponse.json({ items: [] })
  }
}
