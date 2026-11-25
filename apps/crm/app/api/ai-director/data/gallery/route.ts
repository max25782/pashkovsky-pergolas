import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAIDirectorAuth } from '@/lib/middleware/ai-director-auth'
import { isUuid } from '@/lib/gallery/company-scope'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : undefined

/**
 * GET /api/ai-director/data/gallery
 * Query params:
 *   - company_id (required)
 *   - category: gallery category key
 *   - limit: max images (default 50, max 100)
 */
export async function GET(req: NextRequest) {
  const authError = requireAIDirectorAuth(req)
  if (authError) return authError

  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(req.url)

    const companyId = searchParams.get('company_id')
    if (!isUuid(companyId)) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    const { data: categories } = await supabase
      .from('gallery_categories')
      .select('id, key, name_he, name_ru, name_en, description_he, description_ru, description_en, image_count')
      .eq('company_id', companyId)
      .order('key', { ascending: true })

    let imagesQuery = supabase
      .from('gallery_images')
      .select('id, category_key, filename, url, storage_path, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (category) {
      const targetCategory = categories?.find(
        (c) => c.key === category || c.name_he === category || c.name_en === category,
      )
      if (targetCategory) {
        imagesQuery = imagesQuery.eq('category_key', targetCategory.key)
      } else {
        imagesQuery = imagesQuery.eq('category_key', category)
      }
    }

    const { data: images, error: imagesError } = await imagesQuery

    if (imagesError) {
      console.error('[AI Director] Error fetching gallery images:', imagesError)
      return NextResponse.json({ error: 'Failed to fetch gallery images' }, { status: 500 })
    }

    const { data: projects, error: projectsError } = await supabase
      .from('pergola_projects')
      .select('id, title_he, title_ru, title_en, images, published, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (projectsError) {
      console.error('[AI Director] Error fetching projects:', projectsError)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    return NextResponse.json({
      categories: categories || [],
      images: images || [],
      projects,
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
