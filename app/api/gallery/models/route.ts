import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

interface ModelItem {
  type: string
  degem: string
  images: string[]
}

// GET - Get models organized by subdirectory
export async function GET(req: NextRequest) {
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  try {
    // Get all images from dgamim category
    const { data: allImages, error: fetchError } = await supabase
      .from('gallery_images')
      .select('url, filename, storage_path, category_key')
      .eq('category_key', 'dgamim')
      .order('storage_path', { ascending: true })
    
    if (fetchError) {
      console.error('[Models API] Error fetching images:', fetchError)
      return new Response(JSON.stringify({ error: 'Failed to fetch images' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!allImages || allImages.length === 0) {
      console.warn('[Models API] No images found for dgamim')
      return new Response(JSON.stringify({ items: [] }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Group images by model (subdirectory)
    // storage_path format: images/dgamim/{model}/{filename}
    const modelGroups: Record<string, string[]> = {}
    
    for (const image of allImages) {
      const pathParts = image.storage_path.split('/')
      if (pathParts.length >= 3) {
        // Extract model name from path: images/dgamim/atlas/1.jpg -> atlas
        const modelName = pathParts[2]
        
        if (!modelGroups[modelName]) {
          modelGroups[modelName] = []
        }
        
        modelGroups[modelName].push(image.url)
      }
    }
    
    // Convert to array format expected by carousel
    const items: ModelItem[] = Object.entries(modelGroups)
      .map(([modelName, images]) => ({
        type: 'pergola', // or could be extracted from metadata
        degem: modelName,
        images: images.sort(), // Sort images for consistency
      }))
      .sort((a, b) => a.degem.localeCompare(b.degem)) // Sort models alphabetically
    
    console.log(`[Models API] Returning ${items.length} models with ${allImages.length} total images`)
    
    return new Response(JSON.stringify({ items }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('[Models API] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


