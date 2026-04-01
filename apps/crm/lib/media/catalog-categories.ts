/**
 * Single source of truth for catalog section IDs (DB media_assets.category, AI queries).
 * Public site catalog is driven by S3 folders; this is the CRM/DB vocabulary.
 */
export const CATALOG_CATEGORIES = [
  { id: 'pergolas', labelHe: 'פרגולות' },
  { id: 'railings', labelHe: 'מעקות' },
  { id: 'fences', labelHe: 'גדרות' },
  { id: 'laundry_covers', labelHe: 'מסתורי כביסה' },
] as const

export type CatalogCategoryId = (typeof CATALOG_CATEGORIES)[number]['id']

export const CATALOG_CATEGORY_ID_SET = new Set<string>(
  CATALOG_CATEGORIES.map((c) => c.id),
)

export function isValidCatalogCategory(value: string): value is CatalogCategoryId {
  return CATALOG_CATEGORY_ID_SET.has(value)
}
