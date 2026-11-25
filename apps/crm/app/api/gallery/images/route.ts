import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePublicCompanyId } from '@/lib/gallery/company-scope'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Public gallery images — requires company_id query param.
 * No table-wide read; only rows for the requested company.
 */
export async function GET(req: NextRequest) {
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { searchParams } = new URL(req.url)
  const scoped = parsePublicCompanyId(searchParams)
  if ('error' in scoped) return scoped.error

  const categoryKey = searchParams.get('category_key') || 'pergulot'
  const limit = parseInt(searchParams.get('limit') || '3', 10)
  const random = searchParams.get('random') === 'true'

  try {
    const { data: allImages, error: countError } = await supabase
      .from('gallery_images')
      .select('url, filename, category_key')
      .eq('company_id', scoped.companyId)
      .eq('published', true)
      .eq('category_key', categoryKey)
      .order('created_at', { ascending: false })

    if (countError) {
      console.error('[Gallery API] Error fetching images:', countError)
      return new Response(JSON.stringify({ error: 'Failed to fetch images' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!allImages || allImages.length === 0) {
      return new Response(JSON.stringify({ images: [], items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    let images = [...allImages]
    if (random) {
      for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]]
      }
    }

    images = images.slice(0, Math.min(limit, images.length))

    const mediaItems = images.map((img) => {
      let fullUrl = img.url

      if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
        const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
        const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
        if (S3_BUCKET) {
          const cleanPath = fullUrl.startsWith('/') ? fullUrl.slice(1) : fullUrl
          fullUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${cleanPath}`
        }
      }

      const isVideo = /\.(mp4|webm|mov|avi)$/i.test(fullUrl)

      return {
        src: fullUrl,
        type: isVideo ? 'video' : 'image',
      }
    })

    const imageUrls = mediaItems.map((item) => item.src)

    return new Response(
      JSON.stringify({
        images: imageUrls,
        items: mediaItems,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      },
    )
  } catch (error) {
    console.error('[Gallery API] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
