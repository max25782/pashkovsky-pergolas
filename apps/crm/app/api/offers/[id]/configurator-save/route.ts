import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuthAsync } from '@/lib/middleware/auth-async'
import { requireCompanyAccess } from '@/lib/auth'
import {
  applyConfiguratorSyncToOffer,
  type PergolaParamsPayload,
} from '@/lib/configurator/apply-configurator-sync-to-offer'
import { uploadConfiguratorScreenshot } from '@/lib/configurator/upload-configurator-screenshot'
import { mintConfiguratorLinkForOffer } from '@/lib/configurator/mint-configurator-link'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase =
  SUPABASE_URL && SERVICE_KEY
    ? createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'public' } })
    : undefined

function parseParams(body: Record<string, unknown>): PergolaParamsPayload | null {
  if (typeof body.widthCm !== 'number' || typeof body.depthCm !== 'number') return null
  return {
    widthCm: Number(body.widthCm),
    depthCm: Number(body.depthCm),
    heightCm: Number(body.heightCm) || 260,
    color: String(body.color ?? '#9aa0a6'),
    lamellaAngleDeg: Number(body.lamellaAngleDeg) || 0,
    attachedToWall: Boolean(body.attachedToWall),
    lamellaGapCm: Number(body.lamellaGapCm) || 2,
    beamLed: Boolean(body.beamLed),
    lamellaStanding: Boolean(body.lamellaStanding),
    lamellaAlongWidth: Boolean(body.lamellaAlongWidth),
    postProfileId: typeof body.postProfileId === 'string' ? body.postProfileId : null,
    beamProfileId: typeof body.beamProfileId === 'string' ? body.beamProfileId : null,
    dividerProfileId: typeof body.dividerProfileId === 'string' ? body.dividerProfileId : null,
    lamellaProfileId: typeof body.lamellaProfileId === 'string' ? body.lamellaProfileId : null,
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuthAsync(req)
  if (!auth.authorized) return auth.error
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const offerId = params.id
  const { data: row, error: fe } = await supabase.from('offers').select('company_id').eq('id', offerId).single()
  if (fe || !row) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  }
  const access = await requireCompanyAccess(req, row.company_id as string)
  if (!access.authorized) return access.error

  let locale = 'he'
  try {
    const body = await req.json()
    const pergolaParams = parseParams(body as Record<string, unknown>)
    if (!pergolaParams) {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }
    if (typeof body.locale === 'string' && body.locale.length <= 5) locale = body.locale

    const screenshot = typeof body.screenshot === 'string' ? body.screenshot : ''
    const configForRow = { ...body } as Record<string, unknown>
    delete configForRow.screenshot
    delete configForRow.locale

    const { data: inserted, error: insErr } = await supabase
      .from('pergola_config_submissions')
      .insert({
        config: configForRow as Record<string, unknown>,
        screenshot: screenshot && screenshot.length < 50000 ? screenshot : null,
        offer_id: offerId,
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('[configurator-save] insert', insErr)
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    const submissionId = inserted?.id as string

    let previewUrl: string | null = null
    if (screenshot.startsWith('data:image/')) {
      previewUrl = await uploadConfiguratorScreenshot(supabase, offerId, screenshot)
    }

    const { data: offerSnap } = await supabase
      .from('offers')
      .select('configurator_meta')
      .eq('id', offerId)
      .single()
    const existingMeta = offerSnap?.configurator_meta as
      | { editUrl?: string | null; viewUrl?: string | null }
      | null
      | undefined

    let editUrl: string | null =
      typeof existingMeta?.editUrl === 'string' && existingMeta.editUrl.startsWith('http')
        ? existingMeta.editUrl
        : null
    let customerUrl: string | null =
      typeof existingMeta?.viewUrl === 'string' && existingMeta.viewUrl.startsWith('http')
        ? existingMeta.viewUrl
        : null

    const prefill = {
      widthCm: pergolaParams.widthCm,
      depthCm: pergolaParams.depthCm,
      heightCm: pergolaParams.heightCm,
      color: pergolaParams.color,
      lamellaAngleDeg: pergolaParams.lamellaAngleDeg,
      attachedToWall: pergolaParams.attachedToWall,
      lamellaGapCm: pergolaParams.lamellaGapCm,
      beamLed: pergolaParams.beamLed,
      lamellaStanding: pergolaParams.lamellaStanding,
      lamellaAlongWidth: pergolaParams.lamellaAlongWidth,
      postProfileId: pergolaParams.postProfileId,
      beamProfileId: pergolaParams.beamProfileId,
      lamellaProfileId: pergolaParams.lamellaProfileId,
    }

    if (!editUrl || !customerUrl) {
      const minted = await mintConfiguratorLinkForOffer(supabase, offerId, locale)
      editUrl = minted.editUrl
      customerUrl = minted.customerUrl
      await supabase
        .from('configurator_link_tokens')
        .update({ prefill_config: prefill })
        .eq('id', minted.tokenRowId)
    } else {
      const { data: tokRow } = await supabase
        .from('configurator_link_tokens')
        .select('id')
        .eq('offer_id', offerId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (tokRow?.id) {
        await supabase.from('configurator_link_tokens').update({ prefill_config: prefill }).eq('id', tokRow.id)
      }
    }

    const { skippedNonRectangle } = await applyConfiguratorSyncToOffer(supabase, offerId, {
      params: pergolaParams,
      previewImageUrl: previewUrl,
      editUrl,
      customerViewUrl: customerUrl,
      submissionId,
    })

    return NextResponse.json({
      success: true,
      submissionId,
      skippedNonRectangle,
      editUrl,
      customerUrl,
    })
  } catch (e) {
    console.error('[configurator-save]', e)
    const msg = e instanceof Error ? e.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
