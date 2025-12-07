/**
 * Client-side utility to get image URL from S3 or local public folder
 * Uses NEXT_PUBLIC_ environment variables that are available in the browser
 */

const USE_S3 = !!(process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME && process.env.NEXT_PUBLIC_AWS_S3_REGION)

const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || ''
const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1'
const S3_BASE_URL = USE_S3 ? `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : ''

/**
 * Get image URL - returns S3 URL if configured, otherwise local URL
 * @param path Image path relative to public folder (e.g., '/images/pergulot/ashdod/img.webp')
 * @returns Full URL to image
 */
export function getImageUrl(path: string): string {
  // If already a full URL (starts with http:// or https://), return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  if (!USE_S3 || !S3_BUCKET) {
    // Return local URL
    return path
  }
  
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  
  // Return S3 URL
  return `${S3_BASE_URL}/${cleanPath}`
}

/**
 * Check if S3 is configured and being used
 */
export function isUsingS3(): boolean {
  return !!USE_S3 && !!S3_BUCKET
}

/**
 * Get base URL for images
 */
export function getImageBaseUrl(): string {
  return USE_S3 && S3_BUCKET ? S3_BASE_URL : ''
}

