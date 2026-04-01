import {
  CATALOG_COMPANY_NAME,
  CATALOG_INTRO_HE,
  CATALOG_SUBTITLE_HE,
  CATALOG_WHY_US_HE,
  CATALOG_SECTIONS,
  resolveCatalogSectionIdForKey,
} from './catalog-config'
import type { ListedS3Image } from '@/lib/s3-list-catalog-images'

export interface CatalogImageDraft {
  key: string
  caption: null
}

export interface CatalogSectionDraft {
  id: string
  titleHe: string
  descriptionHe: string
  images: CatalogImageDraft[]
}

export interface CatalogPayloadDraft {
  companyName: string
  subtitleHe: string
  introHe: string
  whyUsHe: string
  sections: CatalogSectionDraft[]
}

/**
 * Groups S3 objects into catalog sections using resolveCatalogSectionIdForKey.
 * Each section keeps up to maxImages, newest first.
 */
export function buildCatalogFromS3Objects(
  objects: ListedS3Image[],
  options?: { filterSectionIds?: string[] },
): CatalogPayloadDraft {
  const filter = options?.filterSectionIds?.length ? new Set(options.filterSectionIds) : null

  const buckets = new Map<string, ListedS3Image[]>()
  for (const s of CATALOG_SECTIONS) {
    buckets.set(s.id, [])
  }

  for (const obj of objects) {
    const id = resolveCatalogSectionIdForKey(obj.key)
    if (!id) continue
    if (filter && !filter.has(id)) continue
    buckets.get(id)?.push(obj)
  }

  for (const cfg of CATALOG_SECTIONS) {
    const raw = buckets.get(cfg.id) ?? []
    const filtered = raw.filter((o) => resolveCatalogSectionIdForKey(o.key) === cfg.id)
    buckets.set(cfg.id, filtered)
  }

  function sortByDateDesc(a: ListedS3Image, b: ListedS3Image) {
    return b.lastModified.getTime() - a.lastModified.getTime()
  }

  const sections: CatalogSectionDraft[] = []

  for (const cfg of CATALOG_SECTIONS) {
    if (filter && !filter.has(cfg.id)) continue
    const items = (buckets.get(cfg.id) ?? []).sort(sortByDateDesc).slice(0, cfg.maxImages)
    sections.push({
      id: cfg.id,
      titleHe: cfg.titleHe,
      descriptionHe: cfg.descriptionHe,
      images: items.map((o) => ({ key: o.key, caption: null })),
    })
  }

  return {
    companyName: CATALOG_COMPANY_NAME,
    subtitleHe: CATALOG_SUBTITLE_HE,
    introHe: CATALOG_INTRO_HE,
    whyUsHe: CATALOG_WHY_US_HE,
    sections,
  }
}
