import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY

// Initialize S3 client
export const s3Client = S3_BUCKET && AWS_ACCESS_KEY && AWS_SECRET_KEY
  ? new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
      },
    })
  : null

/**
 * Upload file to S3
 * @param buffer File buffer
 * @param key S3 object key (path)
 * @param mimeType File MIME type
 * @returns Public URL of uploaded file
 */
export async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  if (!s3Client || !S3_BUCKET) {
    throw new Error('S3 not configured. Check AWS environment variables.')
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    // Removed ACL - use Bucket Policy for public access instead
    // Modern S3 buckets use Bucket Policy, not ACLs
  })

  await s3Client.send(command)

  // Return public URL
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

/**
 * Delete file from S3
 * @param key S3 object key (path)
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!s3Client || !S3_BUCKET) {
    throw new Error('S3 not configured. Check AWS environment variables.')
  }

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
  return !!(s3Client && S3_BUCKET && AWS_ACCESS_KEY && AWS_SECRET_KEY)
}

/**
 * Get S3 public URL for a key
 */
export function getS3Url(key: string): string {
  if (!S3_BUCKET) {
    throw new Error('S3 bucket not configured')
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

