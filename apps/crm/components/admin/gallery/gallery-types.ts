export interface GalleryImage {
  id: string
  url: string
  filename: string
  category_key: string
  created_at: string
}

export interface GalleryCategory {
  id: string
  key: string
  name_he?: string
  image_count?: number
}

export interface PergolaProject {
  id: string
  title_he: string
  title_ru?: string
  images: string[]
  created_at: string
}
