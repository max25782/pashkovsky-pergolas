import { authFetch } from '@/lib/api/auth-fetch'
import type { GalleryCategory, GalleryImage, UploadResult } from '@/lib/types/gallery'

const MAX_BATCH_BYTES = 4 * 1024 * 1024 // 4 MB — stay under Vercel 4.5 MB serverless limit
const MAX_FILE_BYTES = 4 * 1024 * 1024

export class GalleryService {
  async fetchCategories(): Promise<GalleryCategory[]> {
    const res = await authFetch('/admin-api/gallery/categories')
    if (!res.ok) throw new Error('Failed to fetch categories')
    const data = await res.json()
    return data.data ?? []
  }

  async fetchImages(categoryKey: string): Promise<GalleryImage[]> {
    const res = await authFetch(`/admin-api/gallery/images?category_key=${encodeURIComponent(categoryKey)}`)
    if (!res.ok) throw new Error('Failed to fetch images')
    const data = await res.json()
    return data.images ?? []
  }

  async deleteImage(imageId: string): Promise<void> {
    const res = await authFetch(`/admin-api/gallery/images?id=${encodeURIComponent(imageId)}`, {
      method: 'DELETE',
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error ?? 'Failed to delete image')
    }
  }

  validateFiles(files: File[]): string | null {
    const oversized = files.filter(f => f.size > MAX_FILE_BYTES)
    if (oversized.length > 0) {
      return `קבצים גדולים מדי (מעל 4 MB): ${oversized.map(f => f.name).join(', ')}`
    }
    return null
  }

  buildBatches(files: File[]): File[][] {
    const batches: File[][] = []
    let current: File[] = []
    let currentSize = 0
    for (const file of files) {
      if (currentSize + file.size > MAX_BATCH_BYTES && current.length > 0) {
        batches.push(current)
        current = []
        currentSize = 0
      }
      current.push(file)
      currentSize += file.size
    }
    if (current.length > 0) batches.push(current)
    return batches
  }

  async uploadBatch(
    batch: File[],
    categoryKey: string,
    folderName: string,
  ): Promise<UploadResult> {
    const form = new FormData()
    form.append('category_key', categoryKey)
    if (folderName.trim()) form.append('folder_name', folderName.trim())
    batch.forEach(f => form.append('files', f))

    const res = await authFetch('/admin-api/gallery/upload', { method: 'POST', body: form })

    if (res.status === 413) {
      throw new Error('הבקשה גדולה מדי. נסה לבחור פחות קבצים בכל פעם.')
    }

    let data: UploadResult & { error?: string }
    try {
      data = await res.json()
    } catch {
      throw new Error(res.statusText || 'Upload failed')
    }

    if (!res.ok) throw new Error(data.error ?? 'Upload failed')
    return data
  }
}

export const galleryService = new GalleryService()
