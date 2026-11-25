import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parsePublicCompanyId } from '@/lib/gallery/company-scope'

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

/**
 * Public models gallery — requires company_id.
 * storage_path: images/{companyId}/dgamim/{model}/{filename}
 * Legacy (pre-migration) paths without companyId are still parsed if present for that company.
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

  try {
    const { data: allImages, error: fetchError } = await supabase
      .from('gallery_images')
      .select('url, filename, storage_path, category_key')
      .eq('company_id', scoped.companyId)
      .eq('published', true)
      .eq('category_key', 'dgamim')
      .order('storage_path', { ascending: true })

    if (fetchError) {
      console.error('[Models API] Error fetching images:', fetchError)
      return new Response(JSON.stringify({ error: 'Failed to fetch images' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!allImages || allImages.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const modelGroups: Record<string, string[]> = {}
    const companySegment = scoped.companyId

    for (const image of allImages) {
      const pathParts = image.storage_path.split('/').filter(Boolean)
      // images/{companyId}/dgamim/{model}/file  OR legacy images/dgamim/{model}/file
      let modelName: string | undefined
      if (pathParts[0] === 'images' && pathParts[1] === companySegment && pathParts[2] === 'dgamim') {
        modelName = pathParts[3]
      } else if (pathParts[0] === 'images' && pathParts[1] === 'dgamim') {
        modelName = pathParts[2]
      }

      if (!modelName) continue
      if (!modelGroups[modelName]) modelGroups[modelName] = []
      modelGroups[modelName].push(image.url)
    }

    const items: ModelItem[] = Object.entries(modelGroups)
      .map(([modelName, images]) => ({
        type: 'pergola',
        degem: modelName,
        images: images.sort(),
      }))
      .sort((a, b) => a.degem.localeCompare(b.degem))

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[Models API] Unexpected error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
