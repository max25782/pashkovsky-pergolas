import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://pashkovsky-group.com'
  const lastmod = new Date()
  const locales: Array<'he'|'ru'|'en'> = ['he','ru','en']

  const paths = ['', '/about', '/contact', '/pergulas', '/railings', '/fences', '/mistora', '/services', '/models', '/legal/privacy', '/legal/terms']

  const entries: MetadataRoute.Sitemap = []
  for (const l of locales){
    for (const p of paths){
      entries.push({
        url: `${base}/${l}${p}`,
        lastModified: lastmod,
        changeFrequency: 'weekly',
        priority: p === '' ? 1 : 0.6,
        alternates: {
          languages: {
            he: `${base}/he${p}`,
            ru: `${base}/ru${p}`,
            en: `${base}/en${p}`,
          }
        }
      })
    }
  }
  return entries
}


