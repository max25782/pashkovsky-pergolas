import { ListObjectsV2Command } from '@aws-sdk/client-s3'

import { getBucket, s3ClientOrThrow } from '@/lib/s3-presign'

const IMAGE_KEY_RE = /\.(webp|jpe?g|png|gif|avif|heic|heif)$/i

export interface ListedS3Image {
  key: string
  lastModified: Date
}

/**
 * Paginated list of image objects under a prefix. Non-image keys skipped.
 */
export async function listAllS3ImagesUnderPrefix(
  prefix: string,
  maxKeys: number,
): Promise<ListedS3Image[]> {
  const client = s3ClientOrThrow()
  const bucket = getBucket()
  if (!bucket) {
    throw new Error('S3 bucket not configured.')
  }

  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`
  const out: ListedS3Image[] = []
  let token: string | undefined

  while (out.length < maxKeys) {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: normalizedPrefix,
      ContinuationToken: token,
      MaxKeys: Math.min(1000, maxKeys - out.length),
    })
    const res = await client.send(command)
    for (const obj of res.Contents ?? []) {
      const key = obj.Key
      if (!key || key.endsWith('/')) continue
      if (!IMAGE_KEY_RE.test(key)) continue
      out.push({
        key,
        lastModified: obj.LastModified ?? new Date(0),
      })
      if (out.length >= maxKeys) break
    }
    if (!res.IsTruncated || !res.NextContinuationToken) break
    token = res.NextContinuationToken
  }

  return out
}
