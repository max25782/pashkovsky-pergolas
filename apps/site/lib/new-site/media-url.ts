import { getImageUrl } from '@/lib/image-url-client'

/**
 * Resolve a media slot value from config/siteMedia.ts to a URL.
 *
 * - empty / undefined  -> null (the UI renders the labelled placeholder)
 * - absolute http(s)   -> returned as is
 * - key + NEXT_PUBLIC_MEDIA_BASE_URL (e.g. CloudFront) -> `${base}/${key}`
 * - key otherwise      -> the existing public S3 URL via getImageUrl
 *   (https://{bucket}.s3.{region}.amazonaws.com/{key}), same convention as the old site.
 */
export function mediaUrl(keyOrUrl: string | null | undefined): string | null {
  const value = keyOrUrl?.trim()
  if (value === undefined || value === '') return null
  if (/^https?:\/\//i.test(value)) return value

  // Keys may contain spaces or Hebrew; encode unless the key is already percent-encoded.
  const key = /%[0-9a-f]{2}/i.test(value) ? value : encodeURI(value)
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim()
  if (base !== undefined && base !== '') {
    return `${base.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`
  }

  const resolved = getImageUrl(key)
  if (/^https?:\/\//i.test(resolved) || resolved.startsWith('/')) return resolved
  return `/${resolved}`
}

/** CSS gradient used to paint an empty slot, from a "hue,saturation,lightness" string. */
export function placeholderGradient(hue: string): string {
  const [h, s, l] = hue.split(',')
  const hn = Number.parseFloat(h)
  if (Number.isNaN(hn) || s === undefined || l === undefined) {
    return 'linear-gradient(165deg, hsl(200, 40%, 30%), hsl(220, 40%, 12%))'
  }
  return `linear-gradient(165deg, hsl(${hn}, ${s}, ${l}), hsl(${hn + 20}, ${s}, 12%))`
}
