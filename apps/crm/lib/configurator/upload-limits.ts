export const CONFIGURATOR_BUCKETS = ['configurator-photos', 'configurator-results'] as const

export type ConfiguratorBucket = (typeof CONFIGURATOR_BUCKETS)[number]

export const CONFIGURATOR_MAX_BYTES = 10 * 1024 * 1024

export const CONFIGURATOR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

const EXT_BY_MIME: Record<(typeof CONFIGURATOR_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function isConfiguratorBucket(value: string): value is ConfiguratorBucket {
  return (CONFIGURATOR_BUCKETS as readonly string[]).includes(value)
}

export function isConfiguratorMime(value: string): value is (typeof CONFIGURATOR_MIME_TYPES)[number] {
  return (CONFIGURATOR_MIME_TYPES as readonly string[]).includes(value)
}

export function configuratorObjectPath(companyId: string, bucket: ConfiguratorBucket, mime: string): string {
  const ext = EXT_BY_MIME[mime as (typeof CONFIGURATOR_MIME_TYPES)[number]] ?? 'bin'
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${companyId}/${bucket}/${id}.${ext}`
}

export const CONFIGURATOR_UPLOAD_RATE = {
  maxRequests: 20,
  windowMs: 60 * 60 * 1000,
}
