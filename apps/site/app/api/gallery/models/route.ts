import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

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

export async function GET(req: NextRequest) {
  try {
    const s3Client = getS3Client()

    if (!s3Client || !S3_BUCKET) {
      return NextResponse.json({ items: [] })
    }

    const prefix = 'images/dgamim/'

    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      Delimiter: '/',
    })

    const response = await s3Client.send(command)
    const modelFolders = response.CommonPrefixes?.map((p) => p.Prefix) ?? []

    if (modelFolders.length === 0) {
      return NextResponse.json({ items: [] })
    }

    const modelGroups: Record<string, string[]> = {}

    for (const folderPrefix of modelFolders) {
      if (!folderPrefix) continue
      const modelName = folderPrefix.replace('images/dgamim/', '').replace('/', '')
      if (!modelName) continue

      const imagesCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: folderPrefix,
      })
      const imagesResponse = await s3Client.send(imagesCommand)
      const images = (imagesResponse.Contents ?? [])
        .filter((obj) => obj.Key !== undefined && obj.Key !== '')
        .map((obj) => `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${obj.Key}`)

      if (images.length > 0) {
        modelGroups[modelName] = images.sort()
      }
    }

    const items: ModelItem[] = Object.entries(modelGroups)
      .map(([modelName, images]) => ({
        type: 'pergola',
        degem: modelName,
        images: images.sort(),
      }))
      .sort((a, b) => a.degem.localeCompare(b.degem))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[Models API] Unexpected error:', error)
    return NextResponse.json({ items: [] })
  }
}
