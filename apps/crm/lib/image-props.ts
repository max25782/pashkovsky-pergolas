/**
 * Quick fix: Add unoptimized flag for S3 images in Next.js Image component
 * This prevents Next.js from trying to optimize external URLs incorrectly
 * Works on both server and client
 */

// Import both versions - Next.js will tree-shake appropriately
import { getImageUrl as getImageUrlClient } from './image-url-client'
import { getImageUrl as getImageUrlServer } from './image-url'

// Use appropriate getImageUrl based on environment
function getImageUrlForProps(path: string): string {
  if (typeof window !== 'undefined') {
    // Client-side: use client version
    return getImageUrlClient(path)
  } else {
    // Server-side: use server version (which now also checks NEXT_PUBLIC_)
    return getImageUrlServer(path)
  }
}

/**
 * Check if URL is from S3 (external)
 */
export function isS3Url(url: string): boolean {
  return url.startsWith('https://') && url.includes('.s3.')
}

/**
 * Get props for Next.js Image component with S3 support
 * Works on both server and client
 */
export function getImageProps(src: string) {
  const imageUrl = getImageUrlForProps(src)
  const isExternal = isS3Url(imageUrl)
  
  return {
    src: imageUrl,
    unoptimized: isExternal, // Disable optimization for external S3 URLs
  }
}

