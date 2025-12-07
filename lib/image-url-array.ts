/**
 * Helper to process image arrays from JSON files
 * Converts all image paths to S3 URLs if configured
 */

import { getImageUrl } from './image-url'

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

