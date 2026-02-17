/**
 * Utility to get image URL from S3 or local public folder
 * Use this helper to switch between S3 and local images
 */

// Check both server and client variables for server-side rendering
const USE_S3 = !!(process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME)
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || ''
const S3_REGION = process.env.AWS_S3_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || 'eu-north-1'
const S3_BASE_URL = USE_S3 && S3_BUCKET ? `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : ''

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
  
  if (!USE_S3) {
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
  return !!USE_S3
}

/**
 * Get base URL for images
 */
export function getImageBaseUrl(): string {
  return USE_S3 ? S3_BASE_URL : ''
}

/**
 * Get absolute URL for Open Graph images (always returns absolute URL)
 * Social networks require absolute URLs for Open Graph images
 * @param path Image path relative to public folder (e.g., '/images/pergulot/ashkelon2/img.webp')
 * @returns Absolute URL to image (S3 URL if configured, otherwise site URL)
 */
export function getOgImageUrl(path: string): string {
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  const SITE_URL = 'https://pashkovsky-group.com'
  
  // If S3 is configured, use S3 URL
  if (USE_S3 && S3_BASE_URL) {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${S3_BASE_URL}/${cleanPath}`
  }
  
  // Otherwise, use site URL with relative path
  // Remove leading slash if present for consistency
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${cleanPath}`
}