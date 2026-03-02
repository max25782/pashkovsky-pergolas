/**
 * Shared image fetching for AI chat routes (both /api/ai-chat and /api/public/ai-chat).
 * Detects pergola type from AI response text, queries media_assets, returns presigned URLs.
 */

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

export async function fetchImagesByContext(text: string): Promise<string[]> {
  const lower = text.toLowerCase()
  const detectedTags = TAG_KEYWORDS
    .filter(({ keywords }) => keywords.some((kw) => lower.includes(kw.toLowerCase())))
    .map(({ tag }) => tag)

  const tagsToQuery = detectedTags.length > 0 ? [detectedTags[0]] : ['פרגולה קלאסית']

  try {
    const host = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'

    const res = await fetch(`${host}/api/media/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: tagsToQuery, limit: 3, random: true }),
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data: { items: Array<{ url: string }> } = await res.json()
      const urls = data.items.map((i) => i.url).filter(Boolean)
      console.log(`[AI Chat] Media query (${tagsToQuery[0]}): ${urls.length} images`)
      if (urls.length > 0) return urls
    }
  } catch (e) {
    console.warn('[AI Chat] Media query failed:', e)
  }
  return []
}
