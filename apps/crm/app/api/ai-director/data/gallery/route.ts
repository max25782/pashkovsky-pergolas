import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/gallery
 * 
 * Provides gallery and completed projects data to Bedrock Agent
 * Query params:
 *   - company_id (required): Company ID for multi-tenant filtering
 *   - category: Filter by category
 *   - limit: Maximum number of images to return (default 50, max 100)
 */
export async function GET(req: NextRequest) {
  // Verify AI Director token
  const authError = requireAIDirectorAuth(req)
  if (authError) return authError
  
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }
  
  try {
    const { searchParams } = new URL(req.url)
    
    // company_id is required
    const companyId = searchParams.get('company_id')
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }
    
    // Filters
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    
    // Query gallery categories
    const { data: categories } = await supabase
      .from('gallery_categories')
      .select('id, name, slug, description')
      .eq('company_id', companyId)
      .order('name', { ascending: true })
    
    // Query gallery images
    let imagesQuery = supabase
      .from('gallery_images')
      .select('id, category_id, title, description, image_url, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (category) {
      // Find category by slug or name
      const targetCategory = categories?.find(c => c.slug === category || c.name === category)
      if (targetCategory) {
        imagesQuery = imagesQuery.eq('category_id', targetCategory.id)
      }
    }
    
    const { data: images, error: imagesError } = await imagesQuery
    
    if (imagesError) {
      console.error('[AI Director] Error fetching gallery images:', imagesError)
      return NextResponse.json({ error: 'Failed to fetch gallery images' }, { status: 500 })
    }
    
    // Query pergola projects (completed deals with images)
    const { data: projects } = await supabase
      .from('pergola_projects')
      .select('id, title, description, location, image_url, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)
    
    return NextResponse.json({ 
      categories: categories || [],
      images: images || [],
      projects: projects || [],
      count: {
        categories: categories?.length || 0,
        images: images?.length || 0,
        projects: projects?.length || 0,
      },
    })
  } catch (error) {
    console.error('[AI Director] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}





