import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

interface MediaItem {
  src: string
  type: 'image' | 'video'
}

/**
 * Fetch gallery images directly from database
 * This is more reliable than fetching from API route in production
 */
export async function getGalleryImages(
  categoryKey: string,
  options: {
    limit?: number
    random?: boolean
  } = {}
): Promise<MediaItem[]> {
  if (!supabase) {
    console.warn('[getGalleryImages] Supabase not configured')
    return []
  }

  const { limit = 100, random = false } = options

  try {
    // Fetch images from database
    let query = supabase
      .from('gallery_images')
      .select('url, filename, storage_path')
      .eq('category_key', categoryKey)

    if (!random) {
      query = query.order('created_at', { ascending: false })
    }

    query = query.limit(limit)

    const { data: images, error } = await query

    if (error) {
      console.error(`[getGalleryImages] Error fetching ${categoryKey}:`, error)
      return []
    }

    if (!images || images.length === 0) {
      console.warn(`[getGalleryImages] No images found for category: ${categoryKey}`)
      return []
    }

    // Shuffle if random
    let processedImages = [...images]
    if (random) {
      for (let i = processedImages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [processedImages[i], processedImages[j]] = [processedImages[j], processedImages[i]]
      }
    }

    // Convert to MediaItem format
    const mediaItems: MediaItem[] = processedImages.map(img => {
      let fullUrl = img.url

      // Ensure full S3 URL
      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
        const S3_REGION = process.env.AWS_S3_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1'
        if (S3_BUCKET) {
          const cleanPath = fullUrl.startsWith('/') ? fullUrl.slice(1) : fullUrl
          fullUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${cleanPath}`
        }
      }

      // Detect video files
      const isVideo = /\.(mp4|webm|mov|avi)$/i.test(fullUrl)

      return {
        src: fullUrl,
        type: isVideo ? 'video' : 'image'
      }
    })

    console.log(`[getGalleryImages] Returning ${mediaItems.length} items for ${categoryKey}`)
    return mediaItems

  } catch (error) {
    console.error(`[getGalleryImages] Unexpected error for ${categoryKey}:`, error)
    return []
  }
}

