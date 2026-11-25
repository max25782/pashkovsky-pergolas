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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Fetch gallery images for one company only.
 * companyId is required (from the request / site tenant mapping) — never reads the whole table.
 */
export async function getGalleryImages(
  categoryKey: string,
  options: {
    limit?: number
    random?: boolean
    companyId: string
  },
): Promise<MediaItem[]> {
  if (!supabase) {
    console.warn('[getGalleryImages] Supabase not configured')
    return []
  }

  const { limit = 100, random = false, companyId } = options
  if (!UUID_RE.test(companyId)) {
    console.warn('[getGalleryImages] companyId required')
    return []
  }

  try {
    let query = supabase
      .from('gallery_images')
      .select('url, filename, storage_path')
      .eq('company_id', companyId)
      .eq('published', true)
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
      return []
    }

    let processedImages = [...images]
    if (random) {
      for (let i = processedImages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [processedImages[i], processedImages[j]] = [processedImages[j], processedImages[i]]
      }
    }

    return processedImages.map((img) => {
      let fullUrl = img.url

      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME
        const S3_REGION = process.env.AWS_S3_REGION || process.env.NEXT_PUBLIC_AWS_S3_REGION || 'us-east-1'
        if (S3_BUCKET) {
          const cleanPath = fullUrl.startsWith('/') ? fullUrl.slice(1) : fullUrl
          fullUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${cleanPath}`
        }
      }

      const isVideo = /\.(mp4|webm|mov|avi)$/i.test(fullUrl)

      return {
        src: fullUrl,
        type: isVideo ? ('video' as const) : ('image' as const),
      }
    })
  } catch (error) {
    console.error(`[getGalleryImages] Unexpected error for ${categoryKey}:`, error)
    return []
  }
}
