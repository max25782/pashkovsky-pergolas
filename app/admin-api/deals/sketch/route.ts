import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(req: NextRequest) {
  if (!auth(req)) return new Response('Unauthorized', { status: 401 })
  if (!supabase) return new Response('Missing Supabase env', { status: 500 })

  try {
    const formData = await req.formData()
    const dealId = formData.get('dealId') as string
    const image = formData.get('image') as File
    const sketchJson = formData.get('sketchJson') as string

    if (!dealId || !image) {
      return new Response('Missing dealId or image', { status: 400 })
    }

    // Загрузка изображения в Supabase Storage
    const fileName = `sketches/${dealId}_${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('deal-files')
      .upload(fileName, image, {
        contentType: 'image/png',
        upsert: true
      })

    if (uploadError) {
      console.error('Ошибка загрузки в Storage:', uploadError)
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Получение публичного URL
    const { data: urlData } = supabase.storage
      .from('deal-files')
      .getPublicUrl(fileName)

    const imageUrl = urlData.publicUrl

    // Парсинг JSON
    let jsonData = null
    if (sketchJson) {
      try {
        jsonData = JSON.parse(sketchJson)
      } catch (e) {
        console.error('Ошибка парсинга sketchJson:', e)
      }
    }

    // Обновление сделки с данными эскиза
    const { data: dealData, error: updateError } = await supabase
      .from('deals')
      .update({
        sketch_image_url: imageUrl,
        sketch_json: jsonData
      })
      .eq('id', dealId)
      .select()
      .single()

    if (updateError) {
      console.error('Ошибка обновления БД:', updateError)
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      imageUrl,
      deal: dealData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Ошибка POST sketch:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}




