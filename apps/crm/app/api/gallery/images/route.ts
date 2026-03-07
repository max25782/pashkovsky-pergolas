import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// Disable caching for this route - we want fresh images every time
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET - Get random images from a category (public, no auth required)
export async function GET(req: NextRequest) {
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const { searchParams } = new URL(req.url)
  const categoryKey = searchParams.get('category_key') || 'pergulot' // Default to pergulot
  const limit = parseInt(searchParams.get('limit') || '3')
  const random = searchParams.get('random') === 'true'
  
  try {
    // First, get all images from the category, sorted by newest first
    const { data: allImages, error: countError } = await supabase
      .from('gallery_images')
      .select('url, filename, category_key')
      .eq('category_key', categoryKey)
      .order('created_at', { ascending: false })
    
    if (countError) {
      console.error('[Gallery API] Error fetching images:', countError)
      return new Response(JSON.stringify({ error: 'Failed to fetch images' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!allImages || allImages.length === 0) {
      console.warn(`[Gallery API] No images found for category: ${categoryKey}`)
      return new Response(JSON.stringify({ images: [] }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Shuffle and take limit
    let images = [...allImages]
    if (random) {
      // Shuffle array
      for (let i = images.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [images[i], images[j]] = [images[j], images[i]]
      }
    }
    
    // Take up to limit
    images = images.slice(0, Math.min(limit, images.length))
    
    
    // Ensure all URLs are full S3 URLs (if S3 is configured)
    // URLs from database should already be S3 URLs, but we ensure they're valid
    // Also detect video files and return them with proper type
    const mediaItems = images.map(img => {
      const url = img.url
      let fullUrl = url
      
      // If URL is not a full URL, construct it
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME
        const S3_REGION = process.env.AWS_S3_REGION || 'us-east-1'
        if (S3_BUCKET) {
          const cleanPath = url.startsWith('/') ? url.slice(1) : url
          fullUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${cleanPath}`
        }
      }
      
      // Detect if it's a video file
      const isVideo = /\.(mp4|webm|mov|avi)$/i.test(fullUrl)
      
      return {
        src: fullUrl,
        type: isVideo ? 'video' : 'image'
      }
    })
    
    // For backward compatibility, also include a simple array of URLs
    const imageUrls = mediaItems.map(item => item.src)
    
    return new Response(JSON.stringify({ 
      images: imageUrls,
      items: mediaItems // New format with type information
    }), { 
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    })
  } catch (error) {
    console.error('[Gallery API] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

