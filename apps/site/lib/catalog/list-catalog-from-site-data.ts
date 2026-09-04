import type { ListedS3Image } from '@/lib/s3-list-catalog-images'

import dgamim from '@/data/gallery/dgamim.json'
import fancy from '@/data/gallery/fancy.json'
import fromShetah from '@/data/gallery/fromShetah.json'
import mestor from '@/data/gallery/mestor.json'
import pergulot from '@/data/gallery/pergulot.json'
import rails from '@/data/gallery/rails.json'
import videos from '@/data/gallery/videos.json'
import windows from '@/data/gallery/windows.json'

const IMAGE_PATH_RE = /(?:^|\/)images\/[^\s"'\\]+\.(?:webp|jpe?g|png|gif|avif)$/i

function collectImageKeys(node: unknown, out: Set<string>): void {
  if (typeof node === 'string') {
    const trimmed = node.trim()
    if (!IMAGE_PATH_RE.test(trimmed)) return
    const withoutQuery = trimmed.split('?')[0]
    const key = withoutQuery.startsWith('/') ? withoutQuery.slice(1) : withoutQuery
    if (key.startsWith('images/')) out.add(key)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) collectImageKeys(item, out)
    return
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectImageKeys(value, out)
  }
}

/**
 * Keys already used by working gallery pages (public S3 URLs).
 * Used when ListObjects is unavailable so catalog matches the rest of the site.
 */
export function listCatalogImagesFromSiteData(): ListedS3Image[] {
  const keys = new Set<string>()
  collectImageKeys(pergulot, keys)
  collectImageKeys(dgamim, keys)
  collectImageKeys(fancy, keys)
  collectImageKeys(fromShetah, keys)
  collectImageKeys(mestor, keys)
  collectImageKeys(rails, keys)
  collectImageKeys(windows, keys)
  collectImageKeys(videos, keys)

  const now = new Date(0)
  return [...keys].map((key) => ({ key, lastModified: now }))
}
