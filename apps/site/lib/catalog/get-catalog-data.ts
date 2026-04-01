import { buildCatalogFromS3Objects } from './build-catalog-s3'
import { CATALOG_SECTIONS, getCatalogS3MaxKeys, getCatalogS3RootPrefix } from './catalog-config'
import { presignGetObject } from '@/lib/s3-presign'
import { listAllS3ImagesUnderPrefix } from '@/lib/s3-list-catalog-images'

export interface CatalogImagePublic {
  key: string
  caption: string | null
  url: string
}

export interface CatalogSectionPublic {
  id: string
  titleHe: string
  descriptionHe: string
  images: CatalogImagePublic[]
}

export interface CatalogPayload {
  companyName: string
  subtitleHe: string
  introHe: string
  whyUsHe: string
  sections: CatalogSectionPublic[]
}

function parseSectionIdsParam(param: string | null): string[] | undefined {
  if (!param || param.trim() === '') return undefined
  return param
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function fetchCatalogPayload(options?: {
  sections?: string | null
  presignExpiresSec?: number
}): Promise<CatalogPayload> {
  const rootPrefix = getCatalogS3RootPrefix()
  const maxKeys = getCatalogS3MaxKeys()
  const filterSectionIds = parseSectionIdsParam(options?.sections ?? null)
  const expires = options?.presignExpiresSec ?? 3600

  const listed = await listAllS3ImagesUnderPrefix(rootPrefix, maxKeys)
  const draft = buildCatalogFromS3Objects(listed, { filterSectionIds })

  const sections: CatalogSectionPublic[] = await Promise.all(
    draft.sections.map(async (sec) => {
      const images: CatalogImagePublic[] = []
      for (const img of sec.images) {
        try {
          const url = await presignGetObject(img.key, expires)
          images.push({ key: img.key, caption: img.caption, url })
        } catch (e) {
          console.error('[catalog] presign failed for key:', img.key, e)
        }
      }
      return {
        id: sec.id,
        titleHe: sec.titleHe,
        descriptionHe: sec.descriptionHe,
        images,
      }
    }),
  )

  return {
    companyName: draft.companyName,
    subtitleHe: draft.subtitleHe,
    introHe: draft.introHe,
    whyUsHe: draft.whyUsHe,
    sections,
  }
}

export function listCatalogSectionIds(): string[] {
  return CATALOG_SECTIONS.map((s) => s.id)
}
