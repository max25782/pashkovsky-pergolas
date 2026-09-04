import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Same bucket the rest of the public site uses for images.
 * Prefer NEXT_PUBLIC_* so catalog does not list a different private bucket.
 */
export function getBucket(): string | undefined {
  return process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME
}

function getRegion(): string {
  return process.env.AWS_S3_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'
}

function getClient(): S3Client | null {
  const bucket = getBucket()
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  if (!bucket || !accessKeyId || !secretAccessKey) return null
  return new S3Client({
    region: getRegion(),
    credentials: { accessKeyId, secretAccessKey },
  })
}

let cachedClient: S3Client | null | undefined

export function s3ClientOrThrow(): S3Client {
  if (cachedClient === undefined) {
    cachedClient = getClient()
  }
  if (!cachedClient) {
    throw new Error(
      'S3 presign not configured. Set AWS_S3_BUCKET_NAME (or NEXT_PUBLIC_AWS_S3_BUCKET_NAME), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.',
    )
  }
  return cachedClient
}

/**
 * Short-lived presigned GET URL. Server-only — never expose credentials to the client.
 */
export async function presignGetObject(key: string, expiresSec = 3600): Promise<string> {
  const bucket = getBucket()
  if (!bucket) {
    throw new Error('S3 bucket not configured for presign.')
  }
  const client = s3ClientOrThrow()
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(client, command, { expiresIn: expiresSec })
}

export function isS3PresignConfigured(): boolean {
  return getClient() !== null && Boolean(getBucket())
}
