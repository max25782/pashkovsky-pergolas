import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteFromS3, isS3Configured } from '@/lib/s3-upload'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { consumeStorageBytes } from '@/lib/storage/quota'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function requireCompanyId(authCheck: { context?: { companyId?: string } }) {
  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return { error: new Response(JSON.stringify({ error: 'Company ID not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }) }
  }
  return { companyId }
}

// GET - List images for a category (company-scoped)
export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const scoped = requireCompanyId(authCheck)
  if ('error' in scoped) return scoped.error

  const { searchParams } = new URL(req.url)
  const categoryKey = searchParams.get('category_key')

  if (!categoryKey) {
    return new Response('Missing category_key parameter', { status: 400 })
  }

  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('company_id', scoped.companyId)
    .eq('category_key', categoryKey)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET gallery images error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch images' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ images: data ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// DELETE - Delete an image (company-scoped)
export async function DELETE(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return authCheck.error

  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  const scoped = requireCompanyId(authCheck)
  if ('error' in scoped) return scoped.error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return new Response('Missing id', { status: 400 })
  }

  const { data: image, error: fetchError } = await supabase
    .from('gallery_images')
    .select('storage_path, url, size')
    .eq('id', id)
    .eq('company_id', scoped.companyId)
    .maybeSingle()

  if (fetchError || !image) {
    return new Response(JSON.stringify({ error: 'Image not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error: dbError } = await supabase
    .from('gallery_images')
    .delete()
    .eq('id', id)
    .eq('company_id', scoped.companyId)

  if (dbError) {
    console.error('DELETE: Database error', dbError)
    return new Response(JSON.stringify({ error: 'Failed to delete image' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (typeof image.size === 'number' && image.size > 0) {
    await consumeStorageBytes(supabase, scoped.companyId, -image.size)
  }

  if (isS3Configured() && image.storage_path) {
    try {
      await deleteFromS3(image.storage_path)
    } catch (s3Error: unknown) {
      console.error('[DELETE] S3 deletion error:', s3Error)
    }
  } else if (!isS3Configured()) {
    console.warn('[DELETE] S3 not configured, skipping file deletion')
  }

  return new Response('OK', { status: 200 })
}
