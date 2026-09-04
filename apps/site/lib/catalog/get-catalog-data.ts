import { buildCatalogFromS3Objects } from './build-catalog-s3'
import { CATALOG_SECTIONS, getCatalogS3MaxKeys, getCatalogS3RootPrefix } from './catalog-config'
import { listCatalogImagesFromSiteData } from './list-catalog-from-site-data'
import { getImageUrl } from '@/lib/image-url'
import { listAllS3ImagesUnderPrefix, type ListedS3Image } from '@/lib/s3-list-catalog-images'

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
}): Promise<CatalogPayload> {
  const rootPrefix = getCatalogS3RootPrefix()
  const maxKeys = getCatalogS3MaxKeys()
  const filterSectionIds = parseSectionIdsParam(options?.sections ?? null)

  let listed: ListedS3Image[]
  try {
    listed = await listAllS3ImagesUnderPrefix(rootPrefix, maxKeys)
  } catch (e) {
    console.error('[catalog] S3 list failed — using public gallery paths like the rest of the site', e)
    listed = []
  }
  if (listed.length === 0) listed = listCatalogImagesFromSiteData()

  const draft = buildCatalogFromS3Objects(listed, { filterSectionIds })

  const sections: CatalogSectionPublic[] = draft.sections.map((sec) => ({
    id: sec.id,
    titleHe: sec.titleHe,
    descriptionHe: sec.descriptionHe,
    images: sec.images.map((img) => ({
      key: img.key,
      caption: img.caption,
      url: getImageUrl(`/${img.key}`),
    })),
  }))

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
