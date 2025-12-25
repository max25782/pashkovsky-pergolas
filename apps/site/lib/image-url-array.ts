/**
 * Helper to process image arrays from JSON files
 * Converts all image paths to S3 URLs if configured
 * 
 * Note: This file is used in both server and client components.
 * For client components, use 'image-url-client' instead.
 */

// Try to use client-side version first (for browser), fallback to server-side
let getImageUrl: (path: string) => string

if (typeof window !== 'undefined') {
  // Client-side: use NEXT_PUBLIC_ variables
  const USE_S3 = !!(process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME && process.env.NEXT_PUBLIC_AWS_S3_REGION)
  const S3_BUCKET = process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME || ''
  const S3_REGION = process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1'
  const S3_BASE_URL = USE_S3 ? `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com` : ''
  
  getImageUrl = (path: string) => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path
    }
    if (!USE_S3 || !S3_BUCKET) {
      return path
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${S3_BASE_URL}/${cleanPath}`
  }
} else {
  // Server-side: use server variables
  const { getImageUrl: serverGetImageUrl } = require('./image-url')
  getImageUrl = serverGetImageUrl
}

/**
 * Process array of image paths
 */
export function processImageArray(images: string[]): string[] {
  return images.map(img => getImageUrl(img))
}

/**
 * Process single image or array of images
 */
export function processImages(images: string | string[]): string | string[] {
  if (Array.isArray(images)) {
    return processImageArray(images)
  }
  return getImageUrl(images)
}


