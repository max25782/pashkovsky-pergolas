import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

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
    // First, get all images from the category
    const { data: allImages, error: countError } = await supabase
      .from('gallery_images')
      .select('url, filename, category_key')
      .eq('category_key', categoryKey)
    
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
    
    console.log(`[Gallery API] Returning ${images.length} images for category ${categoryKey}`)
    
    return new Response(JSON.stringify({ images: images.map(img => img.url) }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Gallery API] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

