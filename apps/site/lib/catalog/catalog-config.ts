/**
 * Catalog sections: Hebrew titles + S3 path rules under CATALOG_S3_PREFIX (default images/).
 * Pergolas: second folder under pergulet|pergulot|pergulas. Wall cladding: dedicated roots + optional wood-look subfolder.
 * Tags / media_assets.category are not used for the public catalog.
 */
export interface CatalogSection {
  id: string
  titleHe: string
  descriptionHe: string
  maxImages: number
}

export const CATALOG_COMPANY_NAME = 'Pashkovsky Group'
export const CATALOG_SUBTITLE_HE =
  'פרגולות, חיפוי קיר, גדרות, מעקות ומסתורי כביסה — אלומיניום ופתרונות חוץ בישראל'
export const CATALOG_INTRO_HE =
  'אנחנו מתמחים בפתרונות אלומיניום יוקרתיים: פרגולות במגוון סגנונות כולל דמוי עץ, חיפוי קיר, מעקות זכוכית, גדרות ומסתורי כביסה. ייעוץ, מדידה והתקנה מקצועית.'
export const CATALOG_WHY_US_HE =
  'ייצור מקומי, חומרים איכותיים, ליווי אישי מהתכנון ועד המסירה — ושקט נפשי לשנים קדימה.'

export const CATALOG_PHONE_DISPLAY = '*2978'
export const CATALOG_PHONE_TEL = 'tel:*2978'
export const CATALOG_WEBSITE_URL = 'https://pashkovsky-group.com'
export const CATALOG_CTA_LABEL_HE = 'יצירת קשר / קביעת פגישה'

const PERGOLA_ROOT_FOLDERS = new Set(['pergulet', 'pergulot', 'pergulas'])

/** Second segment under pergola roots → glass pergola section */
const PERGOLA_GLASS_SUBFOLDERS = new Set([
  'glass',
  'zchuchit',
  'zkukit',
  'glazing',
  'vitrage',
  'vitraz',
  // Hebrew (bucket may use these as folder names)
  'זכוכית',
  'פרגולת-זכוכית',
  'פרגולה-זכוכית',
])

/** Second segment under pergola roots → hi-tech pergola section */
const PERGOLA_HITECH_SUBFOLDERS = new Set([
  'hitech',
  'hi-tech',
  'hitec',
  'hitekh',
  'high-tech',
  'hitech-pergola',
  'הייטק',
  'היי-טק',
  'היי טק',
])

/** Second segment under pergola roots → wood-look pergolas */
const PERGOLA_WOOD_LOOK_SUBFOLDERS = new Set([
  'dmuy-etz',
  'dmuy_etz',
  'wood-look',
  'woodlook',
  'wood_look',
  'woodlook-pergola',
  'דמוי-עץ',
  'דמוי עץ',
])

/** First segment: wall cladding (generic); wood-look variant uses second segment in WALL_WOOD_LOOK_SUBFOLDERS */
const WALL_CLADDING_ROOT_FOLDERS = new Set([
  'chipuy',
  'chifuy',
  'cladding',
  'wall-cladding',
  'wall_cladding',
  'wallcladding',
  'חיפוי',
  'chipuy-kir',
  'chipuy_kir',
])

/** Second segment under wall-cladding roots → חיפוי קיר דמוי עץ */
const WALL_WOOD_LOOK_SUBFOLDERS = new Set([
  'dmuy-etz',
  'dmuy_etz',
  'wood-look',
  'woodlook',
  'wood_look',
  'דמוי-עץ',
  'דמוי עץ',
  'dmuy-etz-kir',
  'wood-cladding',
])

export function getCatalogS3RootPrefix(): string {
  const raw = process.env.CATALOG_S3_PREFIX?.trim() || 'images'
  return raw.endsWith('/') ? raw : `${raw}/`
}

export function getCatalogS3MaxKeys(): number {
  const n = parseInt(process.env.CATALOG_S3_MAX_KEYS ?? '15000', 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50000) : 15000
}

export function getCatalogExcludedFirstFolders(): Set<string> {
  const fromEnv = (process.env.CATALOG_S3_EXCLUDE_FOLDERS ?? 'logos')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return new Set(fromEnv)
}

/**
 * Path segments under the catalog root prefix, e.g. images/pergulet/glass/a.webp → ['pergulet','glass','a.webp']
 */
export function getPathSegmentsUnderCatalogRoot(key: string): string[] {
  const root = getCatalogS3RootPrefix()
  const normalized = root.endsWith('/') ? root : `${root}/`
  const rest = key.startsWith(normalized) ? key.slice(normalized.length) : key
  return rest.split('/').filter(Boolean)
}

function normalizePathSegment(segment: string): string {
  return segment.trim().toLowerCase()
}

/**
 * Map an S3 object key to a catalog section id, or undefined if not part of the catalog.
 */
export function resolveCatalogSectionIdForKey(key: string): string | undefined {
  const excludeFirst = getCatalogExcludedFirstFolders()
  const segs = getPathSegmentsUnderCatalogRoot(key)
  if (segs.length === 0) return undefined

  const first = normalizePathSegment(segs[0])
  if (excludeFirst.has(first)) return undefined

  if (first === 'rails' || first === 'railing') return 'railings'
  if (first === 'fancy' || first === 'social-fences') return 'fences'
  if (first === 'mester' || first === 'mestor') return 'laundry_covers'

  if (WALL_CLADDING_ROOT_FOLDERS.has(first)) {
    const secondRaw = segs[1]
    if (secondRaw !== undefined && secondRaw !== '') {
      const second = normalizePathSegment(secondRaw)
      if (WALL_WOOD_LOOK_SUBFOLDERS.has(second)) return 'wall_cladding_wood'
    }
    return 'wall_cladding'
  }

  if (!PERGOLA_ROOT_FOLDERS.has(first)) return undefined

  const secondRaw = segs[1]
  if (secondRaw === undefined || secondRaw === '') return 'pergola_classic'

  const second = normalizePathSegment(secondRaw)
  if (PERGOLA_GLASS_SUBFOLDERS.has(second)) return 'pergola_glass'
  if (PERGOLA_HITECH_SUBFOLDERS.has(second)) return 'pergola_hitech'
  if (PERGOLA_WOOD_LOOK_SUBFOLDERS.has(second)) return 'pergola_wood_look'
  return 'pergola_classic'
}

/** Display order = catalog section order */
export const CATALOG_SECTIONS: CatalogSection[] = [
  {
    id: 'pergola_classic',
    titleHe: 'פרגולה קלסית',
    descriptionHe: 'פרגולות אלומיניום בסגנון קלאסי — אלגנטיות, עמידות ושילוב מושלם בחצר ובמרפסת.',
    maxImages: 6,
  },
  {
    id: 'pergola_glass',
    titleHe: 'פרגולה זכוכית',
    descriptionHe: 'פרגולות עם מרכיבי זכוכית — תאורה טבעית, מראה יוקרתי ופתרון מודרני.',
    maxImages: 6,
  },
  {
    id: 'pergola_hitech',
    titleHe: 'פרגולה היי טק',
    descriptionHe: 'פרגולות היי-טק — קווים נקיים, עיצוב עכשווי וטכנולוגיית הצללה מתקדמת.',
    maxImages: 6,
  },
  {
    id: 'pergola_wood_look',
    titleHe: 'פרגולות דמוי עץ',
    descriptionHe:
      'פרגולות אלומיניום בגימור דמוי עץ — חום טבעי, עמידות מזג אוויר ותחזוקה נוחה.',
    maxImages: 6,
  },
  {
    id: 'fences',
    titleHe: 'גדרות',
    descriptionHe: 'גדרות אלומיניום עמידות ונקיות — סגירה אסתטית לחצר ולבית פרטי.',
    maxImages: 6,
  },
  {
    id: 'railings',
    titleHe: 'מעקות',
    descriptionHe: 'מעקות אלומיניום וזכוכית בטיחותיים ואסתטיים, למרפסת, גג ומדרגות.',
    maxImages: 6,
  },
  {
    id: 'laundry_covers',
    titleHe: 'מסתורי כביסה',
    descriptionHe: 'מסתורי כביסה אלומיניום — פתרון פרקטי ומעוצב למרפסת השירות.',
    maxImages: 6,
  },
  {
    id: 'wall_cladding',
    titleHe: 'חיפוי קיר',
    descriptionHe: 'חיפויי קיר אלומיניום — עמידות, עיצוב נקי וגימור מקצועי לחזיתות ופנים.',
    maxImages: 6,
  },
  {
    id: 'wall_cladding_wood',
    titleHe: 'חיפוי קיר דמוי עץ',
    descriptionHe: 'חיפוי קיר בגימור דמוי עץ — מראה חמים וטבעי עם יתרונות האלומיניום.',
    maxImages: 6,
  },
]

export function getCatalogSectionById(id: string): CatalogSection | undefined {
  return CATALOG_SECTIONS.find((s) => s.id === id)
}
