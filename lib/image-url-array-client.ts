/**
 * Client-side helper to process image arrays from JSON files
 * Converts all image paths to S3 URLs if configured
 * Uses NEXT_PUBLIC_ environment variables
 */

import { getImageUrl } from './image-url-client'

/**
 * Process array of image paths (client-side)
 */
export function processImageArray(images: string[]): string[] {
  return images.map(img => getImageUrl(img))
}

/**
 * Process single image or array of images (client-side)
 */
export function processImages(images: string | string[]): string | string[] {
  if (Array.isArray(images)) {
    return processImageArray(images)
  }
  return getImageUrl(images)
}




