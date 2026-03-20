import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { uploadToS3, isS3Configured } from '@/lib/s3-upload'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { getSupabaseUrlForServiceRole } from '@/lib/supabase-admin-url'
import { shouldAcceptImageUpload, describeAcceptedFormats } from '@/lib/gallery/accept-upload-image'

/** Allow slow Sharp + S3 for large images (Vercel / serverless). */
export const maxDuration = 120

const SUPABASE_URL = getSupabaseUrlForServiceRole()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

function jsonError(message: string, status: number, details?: string) {
  return new Response(
    JSON.stringify({ error: message, ...(details ? { details } : {}) }),
    { status, headers: { 'Content-Type': 'application/json' } },
  )
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return jsonError('Missing Supabase env', 500)
  if (!isS3Configured()) return jsonError('S3 not configured', 500)

  try {
    const formData = await req.formData()
    const categoryKey = formData.get('category_key') as string
    const folderName = (formData.get('folder_name') as string | null)
      ?.trim()
      .replace(/[^a-zA-Z0-9-_א-ת ]/g, '')
      .replace(/\s+/g, '_') || ''
    const files = formData.getAll('files') as File[]

    if (!categoryKey) return jsonError('Missing category_key', 400)
    if (!files.length) return jsonError('No files provided', 400)

    const { data: category, error: categoryError } = await supabase
      .from('gallery_categories')
      .select('key')
      .eq('key', categoryKey)
      .single()

    if (categoryError || !category) {
      return jsonError('Category not found', 404, categoryError?.message)
    }

    const uploadedImages = []
    const skippedReasons: string[] = []

    for (const file of files) {
      if (!shouldAcceptImageUpload(file)) {
        skippedReasons.push(
          `${file.name}: unsupported (${file.type || 'no MIME'} — ${describeAcceptedFormats()})`,
        )
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        skippedReasons.push(`${file.name}: over ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
        continue
      }

      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // HEIC (iPhone) + JPEG/PNG/… → WebP (auto orientation via EXIF)
        const pipeline = sharp(buffer, { failOn: 'truncated' }).rotate()
        const metadata = await pipeline.metadata()

        if (!metadata.width && !metadata.height) {
          skippedReasons.push(`${file.name}: not a readable image (HEIC may need libheif on server)`)
          continue
        }

        const optimizedBuffer = await pipeline
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85, effort: 6 })
          .toBuffer()

        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 9)
        const originalName = file.name.replace(/\.[^/.]+$/, '')
        const sanitizedName = originalName.replace(/[^a-zA-Z0-9-_]/g, '_')
        const filename = `${sanitizedName}_${timestamp}_${random}.webp`
        const storagePath = folderName
          ? `images/${categoryKey}/${folderName}/${filename}`
          : `images/${categoryKey}/${filename}`

        const publicUrl = await uploadToS3(optimizedBuffer, storagePath, 'image/webp')

        const { data: imageData, error: dbError } = await supabase
          .from('gallery_images')
          .insert({
            category_key: categoryKey,
            filename,
            url: publicUrl,
            storage_path: storagePath,
            size: optimizedBuffer.length,
            width: metadata.width ?? null,
            height: metadata.height ?? null,
            mime_type: 'image/webp',
          })
          .select()
          .single()

        if (dbError) {
          console.error(`[gallery/upload] DB error for ${file.name}:`, dbError.message)
          return jsonError(`Database error for ${file.name}`, 500, dbError.message)
        }

        uploadedImages.push(imageData)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[gallery/upload] Error processing ${file.name}:`, message)
        return jsonError(`Error processing ${file.name}`, 500, message)
      }
    }

    if (uploadedImages.length === 0 && files.length > 0) {
      return jsonError(
        `No images were processed. ${describeAcceptedFormats()} — עד 10MB לכל קובץ.`,
        400,
        skippedReasons.slice(0, 8).join('; ') || undefined,
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        uploaded: uploadedImages.length,
        folder_name: folderName || null,
        images: uploadedImages,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    console.error('[gallery/upload] Unexpected error:', message)
    return jsonError(message, 500)
  }
}
