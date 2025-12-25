export interface GalleryCategory {
  id: string
  key: string
  name_he?: string | null
  name_ru?: string | null
  name_en?: string | null
  description_he?: string | null
  description_ru?: string | null
  description_en?: string | null
  image_count: number
  created_at?: string | null
  updated_at?: string | null
}

export interface GalleryImage {
  id: string
  category_key: string
  filename: string
  url: string
  storage_path: string
  size?: number | null
  width?: number | null
  height?: number | null
  mime_type?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const GALLERY_CATEGORY_KEYS = [
  'fancy',
  'mestor',
  'rails',
  'windows',
  'fromShetah',
  'pergulot',
  'dgamim'
] as const

export type GalleryCategoryKey = typeof GALLERY_CATEGORY_KEYS[number]


