/**
 * Decide whether an uploaded file should be passed to Sharp → WebP.
 * iPhone/Safari often sends HEIC with empty type or application/octet-stream.
 */

const IMAGE_EXTENSIONS = new Set([
  'heic',
  'heif',
  'jpg',
  'jpeg',
  'jpe',
  'png',
  'webp',
  'gif',
  'avif',
  'tif',
  'tiff',
  'bmp',
])

/** Normalized MIME types we accept without relying on extension */
const MIME_ALLOWLIST = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'image/x-ms-bmp',
])

function extensionFromFilename(name: string): string {
  const m = /\.([^.]+)$/i.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}

export function shouldAcceptImageUpload(file: File): boolean {
  const mime = (file.type || '').toLowerCase().trim()
  const ext = extensionFromFilename(file.name)

  if (ext && IMAGE_EXTENSIONS.has(ext)) {
    return true
  }

  if (mime && MIME_ALLOWLIST.has(mime)) {
    return true
  }

  // Any other image/* (e.g. vendor-specific) — Sharp will validate bytes
  if (mime.startsWith('image/')) {
    return true
  }

  return false
}

export function describeAcceptedFormats(): string {
  return 'JPEG, PNG, WebP, GIF, AVIF, HEIC/HEIF (iPhone), TIFF — כולם יומרו אוטומטית ל-WebP'
}
