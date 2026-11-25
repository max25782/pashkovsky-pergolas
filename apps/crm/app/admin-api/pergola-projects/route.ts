import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { s3Client, isS3Configured } from '@/lib/s3-upload'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { companyGalleryPrefix } from '@/lib/gallery/company-scope'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
  : undefined

function companyIdFrom(authCheck: { context?: { companyId?: string } }) {
  const companyId = authCheck.context?.companyId
  if (!companyId) {
    return { error: NextResponse.json({ error: 'Company ID not found' }, { status: 400 }) }
  }
  return { companyId }
}

function imageKeyAllowed(companyId: string, url: string): boolean {
  const match = url.match(/amazonaws\.com\/(.+)$/)
  if (!match) return true
  const key = decodeURIComponent(match[1])
  return key.startsWith(companyGalleryPrefix(companyId)) || key.startsWith(`${companyId}/`)
}

export async function GET(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const scoped = companyIdFrom(authCheck)
  if ('error' in scoped) return scoped.error

  const { data, error } = await supabase
    .from('pergola_projects')
    .select('*')
    .eq('company_id', scoped.companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET pergola_projects error', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }

  return NextResponse.json({ projects: data || [] })
}

export async function POST(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const scoped = companyIdFrom(authCheck)
  if ('error' in scoped) return scoped.error

  try {
    const body = await req.json()
    const {
      title_he,
      title_ru,
      title_en,
      desc_he,
      desc_ru,
      desc_en,
      images,
      published,
    } = body || {}

    if (!title_he) {
      return NextResponse.json({ error: 'title_he is required' }, { status: 400 })
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'images[] is required' }, { status: 400 })
    }
    if (images.some((url: unknown) => typeof url === 'string' && !imageKeyAllowed(scoped.companyId, url))) {
      return NextResponse.json({ error: 'Image is outside your company storage' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('pergola_projects')
      .insert({
        company_id: scoped.companyId,
        title_he,
        title_ru: title_ru || null,
        title_en: title_en || null,
        desc_he: desc_he || null,
        desc_ru: desc_ru || null,
        desc_en: desc_en || null,
        images,
        published: published !== false,
      })
      .select()
      .single()

    if (error) {
      console.error('POST pergola_projects error', error)
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
    }

    return NextResponse.json({ project: data }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e instanceof Error ? e.message : String(e)) || 'Bad request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const authCheck = await requireAuthAsync(req)
  if (!authCheck.authorized) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const scoped = companyIdFrom(authCheck)
  if ('error' in scoped) return scoped.error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const deleteS3 = searchParams.get('delete_s3') === '1'
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: project, error: fetchError } = await supabase
    .from('pergola_projects')
    .select('images')
    .eq('id', id)
    .eq('company_id', scoped.companyId)
    .maybeSingle()

  if (fetchError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const s3Deleted: string[] = []
  const s3Errors: string[] = []
  if (deleteS3 && isS3Configured() && s3Client && Array.isArray(project.images)) {
    const bucket = process.env.AWS_S3_BUCKET_NAME!
    for (const url of project.images as string[]) {
      try {
        const match = url.match(/amazonaws\.com\/(.+)$/)
        if (!match) continue
        const key = decodeURIComponent(match[1])
        if (!imageKeyAllowed(scoped.companyId, url)) continue
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        s3Deleted.push(key)
      } catch (e: unknown) {
        s3Errors.push(url)
        console.error('S3 delete error', e instanceof Error ? e.message : String(e))
      }
    }
  }

  const { data: removed, error } = await supabase
    .from('pergola_projects')
    .delete()
    .eq('id', id)
    .eq('company_id', scoped.companyId)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('DELETE pergola_projects error', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
  if (!removed) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, s3_deleted: s3Deleted, s3_errors: s3Errors })
}
