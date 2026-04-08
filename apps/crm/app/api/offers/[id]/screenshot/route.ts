/**
 * POST /api/offers/[id]/screenshot
 *
 * Saves a 3D canvas screenshot for an offer without modifying any pricing or
 * dimension data. Used by the Quick Offer PDF flow to auto-capture the 3D view
 * before generating the PDF.
 *
 * Body: { screenshot: string } — PNG data URL (data:image/png;base64,...)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import { uploadConfiguratorScreenshot } from '@/lib/configurator/upload-configurator-screenshot'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  if (!supabase) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const offerId = params.id
  const { data: row, error: fe } = await supabase.from('offers').select('company_id, configurator_meta').eq('id', offerId).single()
  if (fe || !row) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

  const access = await requireCompanyAccess(req, row.company_id as string)
  if (!access.authorized) return access.error

  let body: { screenshot?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const screenshot = typeof body.screenshot === 'string' ? body.screenshot : ''
  if (!screenshot.startsWith('data:image/')) {
    return NextResponse.json({ error: 'Invalid screenshot' }, { status: 400 })
  }

  const previewUrl = await uploadConfiguratorScreenshot(supabase, offerId, screenshot)
  if (!previewUrl) {
    return NextResponse.json({ error: 'Failed to upload screenshot' }, { status: 500 })
  }

  const existingMeta = (row.configurator_meta ?? {}) as Record<string, unknown>
  const updatedMeta = {
    ...existingMeta,
    previewImageUrl: previewUrl,
    updatedAt: new Date().toISOString(),
  }

  const { error: upErr } = await supabase
    .from('offers')
    .update({ configurator_meta: updatedMeta })
    .eq('id', offerId)

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  return NextResponse.json({ previewUrl })
}
