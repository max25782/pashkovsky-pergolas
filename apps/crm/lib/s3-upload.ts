// S3 upload utility for CRM (orders PDF, etc.)
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
    const missingVars = []
    if (!S3_BUCKET) missingVars.push('AWS_S3_BUCKET_NAME')
    if (!AWS_ACCESS_KEY) missingVars.push('AWS_ACCESS_KEY_ID')
    if (!AWS_SECRET_KEY) missingVars.push('AWS_SECRET_ACCESS_KEY')
    
    throw new Error(
      `S3 not configured. Missing environment variables: ${missingVars.join(', ')}`
    )
  }

  // Log configuration (masked) for debugging
  const maskedKey = AWS_ACCESS_KEY 
    ? `${AWS_ACCESS_KEY.substring(0, 8)}...${AWS_ACCESS_KEY.substring(AWS_ACCESS_KEY.length - 4)}`
    : 'not set'
  
  console.log('[S3 Upload] Configuration:', {
    bucket: S3_BUCKET,
    region: S3_REGION,
    accessKeyId: maskedKey,
    hasSecretKey: !!AWS_SECRET_KEY,
  })

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    // Set metadata to ensure CORS headers are applied
    CacheControl: 'public, max-age=31536000, immutable',
    ContentDisposition: 'inline',
    // Removed ACL - use Bucket Policy for public access instead
    // Modern S3 buckets use Bucket Policy, not ACLs
  })

  try {
    await s3Client.send(command)
  } catch (error: any) {
    // Enhanced error logging for AWS credential issues
    if (error.name === 'InvalidAccessKeyId' || error.Code === 'InvalidAccessKeyId') {
      console.error('[S3 Upload] AWS Credentials Error:', {
        error: error.message,
        accessKeyId: maskedKey,
        bucket: S3_BUCKET,
        region: S3_REGION,
        hint: 'Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local or Vercel environment variables',
      })
      throw new Error(
        `Invalid AWS Access Key ID: ${maskedKey}. ` +
        `Please verify AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct and the key exists in AWS IAM.`
      )
    }
    throw error
  }

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

