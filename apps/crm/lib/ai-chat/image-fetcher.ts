/**
 * Shared image fetching for AI chat routes (both /api/ai-chat and /api/public/ai-chat).
 * Detects pergola type from AI response text, queries media_assets directly via Supabase
 * (no internal HTTP round-trip), returns presigned S3 URLs.
 */

import { createClient } from '@supabase/supabase-js'
import { presignGetObject } from '@/lib/s3-upload'

const TAG_KEYWORDS: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ['קלאסי', 'קלאסית', 'classic'], tag: 'פרגולה קלאסית' },
  { keywords: ['היי-טק', 'היטק', 'high tech', 'hightech'], tag: 'פרגולה היי-טק' },
  { keywords: ['מטבח חוץ', 'מטבח', 'kitchen'], tag: 'פרגולה למטבח חוץ' },
  { keywords: ['ביוקלמטיק', 'bioclimatic'], tag: 'פרגולה ביוקלמטיק' },
  { keywords: ['pvc', 'פי וי סי'], tag: 'פרגולה pvc' },
  { keywords: ['תלויה', 'hanging', 'suspended'], tag: 'פרגולה תלויה' },
  { keywords: ['עץ', 'wood', 'wooden'], tag: 'פרגולה דמוי עץ' },
  { keywords: ['זכוכית', 'glass', 'יוקרה'], tag: 'פרגולה יוקרה עם כיסוי זכוכית' },
]

// Single-tenant fallback — same company ID used across the app
const DEFAULT_COMPANY_ID =
  process.env.DEFAULT_COMPANY_ID ?? '6998295e-89ae-4e3d-afd2-8c2b0333eac2'

export async function fetchImagesByContext(text: string): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.warn('[AI Chat] Supabase not configured — skipping image fetch')
    return []
  }

  const lower = text.toLowerCase()
  const detectedTags = TAG_KEYWORDS
    .filter(({ keywords }) => keywords.some((kw) => lower.includes(kw.toLowerCase())))
    .map(({ tag }) => tag)

  const tagsToQuery = detectedTags.length > 0 ? [detectedTags[0]] : ['פרגולה קלאסית']

  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase
      .from('media_assets')
      .select('s3_key')
      .eq('company_id', DEFAULT_COMPANY_ID)
      .contains('tags', tagsToQuery)
      .limit(30)

    if (error) {
      console.warn('[AI Chat] Supabase media query error:', error.message)
      return []
    }

    const rows = data ?? []
    if (rows.length === 0) {
      console.log(`[AI Chat] No images found for tag: ${tagsToQuery[0]}`)
      return []
    }

    // Pick up to 3 at random
    const shuffled = rows.sort(() => Math.random() - 0.5).slice(0, 3)

    const urls = await Promise.all(
      shuffled.map(async ({ s3_key }) => {
        try {
          return await presignGetObject(s3_key, 900)
        } catch {
          return ''
        }
      }),
    )

    const valid = urls.filter(Boolean)
    console.log(`[AI Chat] Media query (${tagsToQuery[0]}): ${valid.length} images`)
    return valid
  } catch (e) {
    console.warn('[AI Chat] fetchImagesByContext failed:', e)
    return []
  }
}
