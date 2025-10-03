import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://pashkovsky-pergolas.vercel.app'
  const lastmod = new Date()
  const locales: Array<'he'|'ru'|'en'> = ['he','ru','en']

  const paths = ['', '/about', '/contact', '/pergulas', '/railings', '/fences', '/mistora', '/services', '/models']

  const entries: MetadataRoute.Sitemap = []
  for (const l of locales){
    for (const p of paths){
      entries.push({ url: `${base}/${l}${p}`, lastModified: lastmod, changeFrequency: 'weekly', priority: p === '' ? 1 : 0.6 })
    }
  }
  return entries
}


