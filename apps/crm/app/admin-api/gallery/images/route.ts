import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { deleteFromS3, isS3Configured } from '@/lib/s3-upload'
import { requireAuth } from '@/lib/middleware/auth'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

// GET - List images for a category
export async function GET(req: NextRequest) {
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { searchParams } = new URL(req.url)
  const categoryKey = searchParams.get('category_key')
  
  if (!categoryKey) {
    return new Response('Missing category_key parameter', { status: 400 })
  }
  
  const { data, error } = await supabase
    .from('gallery_images')
    .select('*')
    .eq('category_key', categoryKey)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('GET gallery images error:', error)
    return new Response(JSON.stringify(error), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  return new Response(JSON.stringify({ images: data ?? [] }), { 
    status: 200, 
    headers: { 'Content-Type': 'application/json' } 
  })
}

// DELETE - Delete an image
export async function DELETE(req: NextRequest) {
  const authCheck = requireAuth(req)
  if (!authCheck.authorized) return authCheck.error
  
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })
  
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  
  if (!id) {
    return new Response('Missing id', { status: 400 })
  }
  
  // Получаем информацию об изображении перед удалением
  const { data: image, error: fetchError } = await supabase
    .from('gallery_images')
    .select('storage_path, url')
    .eq('id', id)
    .single()
  
  if (fetchError || !image) {
    return new Response(JSON.stringify({ error: 'Image not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  // Удаляем из базы данных (триггер автоматически обновит счетчик категории)
  const { error: dbError } = await supabase
    .from('gallery_images')
    .delete()
    .eq('id', id)
  
  if (dbError) {
    console.error('DELETE: Database error', dbError)
    return new Response(JSON.stringify(dbError), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  // Удаляем файл из S3 (если настроен)
  if (isS3Configured() && image.storage_path) {
    try {
      await deleteFromS3(image.storage_path)
      console.log(`[DELETE] Successfully deleted from S3: ${image.storage_path}`)
    } catch (s3Error: any) {
      console.error('[DELETE] S3 deletion error:', s3Error)
      // Не возвращаем ошибку, так как запись из БД уже удалена
    }
  } else if (!isS3Configured()) {
    console.warn('[DELETE] S3 not configured, skipping file deletion')
  }
  
  return new Response('OK', { status: 200 })
}


