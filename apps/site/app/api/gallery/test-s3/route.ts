/**
 * Test S3 Connection and List Objects
 * GET /api/gallery/test-s3?prefix=images/dgamim/
 * 
 * This endpoint helps debug S3 connectivity issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || process.env.AWS_S3_REGION || 'eu-north-1'

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const prefix = searchParams.get('prefix') || 'images/'

  const config = {
    bucket: S3_BUCKET || 'NOT SET',
    region: S3_REGION,
    hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    prefix,
  }

  console.log('[Test S3] Configuration:', config)

  const s3Client = getS3Client()

  if (!s3Client || !S3_BUCKET) {
    return NextResponse.json({
      success: false,
      error: 'S3 not configured',
      config,
    }, { status: 500 })
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: prefix,
      MaxKeys: 100, // Limit for testing
    })

    const response = await s3Client.send(command)
    const contents = response.Contents || []

    return NextResponse.json({
      success: true,
      config: {
        ...config,
        accessKeyPreview: process.env.AWS_ACCESS_KEY_ID?.substring(0, 8) + '...',
      },
      s3Response: {
        totalObjects: contents.length,
        isTruncated: response.IsTruncated,
        nextContinuationToken: response.NextContinuationToken,
        keys: contents.map(obj => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
        })),
        commonPrefixes: response.CommonPrefixes?.map(p => p.Prefix) || [],
      },
    })
  } catch (error: any) {
    console.error('[Test S3] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      errorCode: error.Code,
      config,
    }, { status: 500 })
  }
}

