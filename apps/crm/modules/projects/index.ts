/**
 * modules/projects — Pergola Projects & Gallery
 *
 * Canonical import path for all projects/gallery-related code.
 * New code should import from '@/modules/projects'.
 *
 * Responsibilities:
 *   - Installation project lifecycle
 *   - Pergola project gallery (S3-backed)
 *   - Photo management
 */

// Types (lib/types/gallery.ts — server-side)
export {
  type GalleryCategory,
  type GalleryImage,
  type PergolaProject,
  type UploadResult,
  type DeleteProjectResult,
} from '@/lib/types/gallery'

// Types (components/admin/gallery-types.ts — client-side, includes category keys)
export {
  GALLERY_CATEGORY_KEYS,
  type GalleryCategoryKey,
} from '@/components/admin/gallery-types'

// Services
export { projectService, ProjectService } from '@/lib/api/project-service'
export { galleryService, GalleryService } from '@/lib/api/gallery-service'

// UI Components
export { default as ProjectsTab } from '@/components/admin/gallery/ProjectsTab'
export { default as GalleryManageTab } from '@/components/admin/gallery/GalleryManageTab'
export { default as GalleryUploadTab } from '@/components/admin/gallery/GalleryUploadTab'
export { default as ImageGrid } from '@/components/admin/gallery/ImageGrid'
export { default as PhotoUploadModal } from '@/components/admin/PhotoUploadModal'
export { default as GalleryImagesList } from '@/components/admin/GalleryImagesList'
