import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function auth(req: NextRequest) {
  const token = req.headers.get('x-admin-token') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const expected = process.env.ADMIN_TOKEN
  return !!expected && token === expected
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

// POST - Upload photos to a category
export async function POST(req: NextRequest) {
  console.log('POST /admin-api/gallery/upload called')
  
  if (!auth(req)) {
    console.error('Unauthorized request')
    return new Response('Unauthorized', { status: 401 })
  }
  
  if (!supabase) {
    console.error('Missing Supabase env')
    return new Response('Missing Supabase env', { status: 500 })
  }
  
  try {
    console.log('Parsing form data...')
    const formData = await req.formData()
    const categoryKey = formData.get('category_key') as string
    const files = formData.getAll('files') as File[]
    
    console.log('Form data parsed:', { categoryKey, filesCount: files.length })
    
    if (!categoryKey) {
      return new Response(JSON.stringify({ error: 'Missing category_key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Проверяем и создаем bucket если его нет
    console.log('Checking bucket gallery-images...')
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
    } else {
      const bucketExists = buckets?.some(b => b.name === 'gallery-images')
      
      if (!bucketExists) {
        console.log('Bucket not found, creating gallery-images bucket...')
        const { data: newBucket, error: createError } = await supabase.storage.createBucket('gallery-images', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
        })
        
        if (createError) {
          console.error('Error creating bucket:', createError)
          return new Response(JSON.stringify({ 
            error: 'Failed to create storage bucket', 
            details: createError.message 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        console.log('Bucket created successfully:', newBucket)
      } else {
        console.log('Bucket exists')
      }
    }
    
    // Проверяем существование категории
    console.log('Checking category:', categoryKey)
    const { data: category, error: categoryError } = await supabase
      .from('gallery_categories')
      .select('key')
      .eq('key', categoryKey)
      .single()
    
    if (categoryError || !category) {
      console.error('Category error:', categoryError)
      return new Response(JSON.stringify({ error: 'Category not found', details: categoryError?.message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    console.log('Category found:', category)
    const uploadedImages = []
    let processedCount = 0
    
    for (const file of files) {
      processedCount++
      console.log(`Processing file ${processedCount}/${files.length}: ${file.name}`)
      
      // Валидация типа файла
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        console.warn(`Skipping file ${file.name}: invalid MIME type ${file.type}`)
        continue
      }
      
      // Валидация размера
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`Skipping file ${file.name}: file too large (${file.size} bytes)`)
        continue
      }
      
      try {
        console.log(`Reading file ${file.name}...`)
        // Читаем файл в буфер
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        console.log(`File read, size: ${buffer.length} bytes`)
        
        // Обрабатываем изображение через sharp
        console.log(`Processing image with sharp...`)
        const image = sharp(buffer)
        const metadata = await image.metadata()
        console.log(`Image metadata:`, { width: metadata.width, height: metadata.height, format: metadata.format })
        
        // Оптимизируем изображение: конвертируем в WebP, ограничиваем размер, сжимаем
        console.log(`Optimizing image...`)
        const optimizedBuffer = await image
          .resize(1920, 1920, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 85, effort: 6 })
          .toBuffer()
        console.log(`Image optimized, new size: ${optimizedBuffer.length} bytes`)
        
        // Генерируем уникальное имя файла
        const timestamp = Date.now()
        const random = Math.random().toString(36).substring(2, 9)
        const originalName = file.name.replace(/\.[^/.]+$/, '')
        const sanitizedName = originalName.replace(/[^a-zA-Z0-9-_]/g, '_')
        const filename = `${sanitizedName}_${timestamp}_${random}.webp`
        const storagePath = `${categoryKey}/${filename}`
        console.log(`Generated filename: ${filename}, storage path: ${storagePath}`)
        
        // Загружаем в Supabase Storage
        console.log(`Uploading to Supabase Storage...`)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('gallery-images')
          .upload(storagePath, optimizedBuffer, {
            contentType: 'image/webp',
            upsert: false
          })
        
        if (uploadError) {
          console.error(`Upload error for ${file.name}:`, uploadError)
          return new Response(JSON.stringify({ 
            error: `Upload failed for ${file.name}`, 
            details: uploadError.message || String(uploadError)
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        console.log(`File uploaded successfully:`, uploadData)
        
        // Получаем публичный URL
        const { data: urlData } = supabase.storage
          .from('gallery-images')
          .getPublicUrl(storagePath)
        
        const publicUrl = urlData.publicUrl
        console.log(`Public URL: ${publicUrl}`)
        
        // Сохраняем метаданные в базу данных
        console.log(`Saving to database...`)
        const { data: imageData, error: dbError } = await supabase
          .from('gallery_images')
          .insert({
            category_key: categoryKey,
            filename,
            url: publicUrl,
            storage_path: storagePath,
            size: optimizedBuffer.length,
            width: metadata.width || null,
            height: metadata.height || null,
            mime_type: 'image/webp'
          })
          .select()
          .single()
        
        if (dbError) {
          console.error(`Database error for ${file.name}:`, dbError)
          // Удаляем загруженный файл из storage если не удалось сохранить в БД
          await supabase.storage.from('gallery-images').remove([storagePath])
          return new Response(JSON.stringify({ 
            error: `Database error for ${file.name}`, 
            details: dbError.message 
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
        
        console.log(`Image saved to database:`, imageData)
        uploadedImages.push(imageData)
      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error)
        return new Response(JSON.stringify({ 
          error: `Error processing ${file.name}`, 
          details: error.message,
          stack: error.stack 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      uploaded: uploadedImages.length,
      images: uploadedImages
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Upload failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

