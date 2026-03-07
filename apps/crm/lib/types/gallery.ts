export interface GalleryCategory {
  id: string
  key: string
  name_he: string
  name_ru?: string
  name_en?: string
  image_count?: number
}

export interface GalleryImage {
  id: string
  url: string
  filename: string
  category_key: string
  storage_path: string
  size?: number
  width?: number | null
  height?: number | null
  mime_type?: string
  created_at: string
}

export interface PergolaProject {
  id: string
  title_he: string
  title_ru?: string | null
  title_en?: string | null
  desc_he?: string | null
  images: string[]
  created_at: string
}

export interface UploadResult {
  uploaded: number
  folder_name: string | null
  images: Array<{ id: string; url: string; filename: string }>
}

export interface DeleteProjectResult {
  deleted: boolean
  s3_deleted?: string[]
  s3_errors?: string[]
}
